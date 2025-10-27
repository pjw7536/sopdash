import { NextResponse } from "next/server"

import { runQuery } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EXCLUDED_SCHEMAS = [
  "information_schema",
  "mysql",
  "performance_schema",
  "sys",
]

const IDENTIFIER_PART_REGEX = /^[A-Za-z0-9_]+$/
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 1000

type TableListRow = {
  tableSchema: string | null
  tableName: string
}

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

function normalizeRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const plain: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(row)) {
      if (/^\d+$/.test(key)) {
        continue
      }

      plain[key] = value
    }

    return plain
  })
}

function parseLimit(rawLimit: string | null) {
  if (!rawLimit) {
    return DEFAULT_LIMIT
  }

  const parsed = Number.parseInt(rawLimit, 10)

  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_LIMIT
  }

  return Math.min(parsed, MAX_LIMIT)
}

async function fetchTableList({
  schema,
  includeSystem,
}: {
  schema: string | null
  includeSystem: boolean
}) {
  const params: unknown[] = []
  const predicates: string[] = ["table_type = 'BASE TABLE'"]

  if (schema) {
    predicates.push("table_schema = ?")
    params.push(schema)
  } else if (!includeSystem) {
    predicates.push(
      `table_schema NOT IN (${EXCLUDED_SCHEMAS.map(() => "?").join(", ")})`
    )
    params.push(...EXCLUDED_SCHEMAS)
  }

  const whereClause =
    predicates.length > 0 ? `WHERE ${predicates.join(" AND ")}` : ""

  const rows = await runQuery<TableListRow[]>(
    `
      SELECT
        table_schema AS tableSchema,
        table_name AS tableName
      FROM information_schema.tables
      ${whereClause}
      ORDER BY table_schema, table_name;
    `,
    params
  )

  return rows.map((row) => ({
    schema: row.tableSchema,
    name: row.tableName,
    fullName: row.tableSchema
      ? `${row.tableSchema}.${row.tableName}`
      : row.tableName,
  }))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const schema = url.searchParams.get("schema")
  const includeSystem =
    url.searchParams.get("includeSystem") === "true"
  const table = url.searchParams.get("table")

  try {
    if (!table) {
      const tables = await fetchTableList({ schema, includeSystem })
      return NextResponse.json({ tables })
    }

    const limit = parseLimit(url.searchParams.get("limit"))
    const identifierParts = sanitizeTableIdentifier(table)
    const placeholder = buildTablePlaceholder(identifierParts)

    const rows = await runQuery<Array<Record<string, unknown>>>(
      `SELECT * FROM ${placeholder} LIMIT ?`,
      [...identifierParts, limit]
    )

    const normalizedRows = normalizeRows(rows)
    const columns =
      normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : []

    return NextResponse.json({
      table: identifierParts.join("."),
      limit,
      rowCount: normalizedRows.length,
      columns,
      rows: normalizedRows,
    })
  } catch (error) {
    if (error instanceof InvalidTableIdentifierError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.error("Failed to load table data", error)
    return NextResponse.json(
      { error: "Failed to load table data" },
      { status: 500 }
    )
  }
}
