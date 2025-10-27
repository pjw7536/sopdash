import { NextResponse } from "next/server"

import { runQuery } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const IDENTIFIER_PART_REGEX = /^[A-Za-z0-9_]+$/

class InvalidTableIdentifierError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidTableIdentifierError"
  }
}

function sanitizeTableIdentifier(identifier: string) {
  const parts = identifier.split(".").map((part) => part.trim()).filter(Boolean)

  if (parts.length === 0) {
    throw new InvalidTableIdentifierError("Table name is required")
  }

  for (const part of parts) {
    if (!IDENTIFIER_PART_REGEX.test(part)) {
      throw new InvalidTableIdentifierError("Only alphanumeric characters and underscores are allowed in table names")
    }
  }

  return parts
}

function buildTablePlaceholder(parts: string[]) {
  return parts.map(() => "??").join(".")
}

type UpdateBody = {
  table?: string
  id?: string | number
  updates?: {
    comment?: unknown
    needtosend?: unknown
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as UpdateBody
    const { table, id, updates } = body

    if (!table || typeof table !== "string") {
      return NextResponse.json(
        { error: "Parameter 'table' is required." },
        { status: 400 }
      )
    }

    if (id === undefined || id === null) {
      return NextResponse.json(
        { error: "Parameter 'id' is required." },
        { status: 400 }
      )
    }

    const numericId = Number.parseInt(String(id), 10)
    if (Number.isNaN(numericId)) {
      return NextResponse.json(
        { error: "Parameter 'id' must be a number." },
        { status: 400 }
      )
    }

    if (!updates || typeof updates !== "object") {
      return NextResponse.json(
        { error: "Parameter 'updates' is required." },
        { status: 400 }
      )
    }

    const nextValues: Array<{ column: "comment" | "needtosend"; value: unknown }> = []

    if ("comment" in updates) {
      const commentValue = updates.comment
      if (
        commentValue !== null &&
        commentValue !== undefined &&
        typeof commentValue !== "string"
      ) {
        return NextResponse.json(
          { error: "Field 'comment' must be a string or null." },
          { status: 400 }
        )
      }
      nextValues.push({ column: "comment", value: commentValue ?? "" })
    }

    if ("needtosend" in updates) {
      const rawNeedToSend = updates.needtosend
      const numeric = Number.parseInt(String(rawNeedToSend), 10)
      if (Number.isNaN(numeric) || (numeric !== 0 && numeric !== 1)) {
        return NextResponse.json(
          { error: "Field 'needtosend' must be 0 or 1." },
          { status: 400 }
        )
      }
      nextValues.push({ column: "needtosend", value: numeric })
    }

    if (nextValues.length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update." },
        { status: 400 }
      )
    }

    const identifierParts = sanitizeTableIdentifier(table)
    const placeholder = buildTablePlaceholder(identifierParts)
    const setClause = nextValues.map(({ column }) => `${column} = ?`).join(", ")
    const params = [
      ...identifierParts,
      ...nextValues.map(({ value }) => value),
      numericId,
    ]

    await runQuery(
      `UPDATE ${placeholder} SET ${setClause} WHERE id = ?`,
      params
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof InvalidTableIdentifierError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.error("Failed to update table row", error)
    return NextResponse.json(
      { error: "Failed to update the row." },
      { status: 500 }
    )
  }
}
