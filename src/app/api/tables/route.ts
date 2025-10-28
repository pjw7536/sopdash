import { NextResponse } from "next/server"
import type { MysqlError } from "mysql2"

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
const DEFAULT_SINCE_DAYS = 3
const FALLBACK_ROW_LIMIT = 200

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

function isUnknownColumnError(error: unknown): error is MysqlError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as MysqlError).code === "ER_BAD_FIELD_ERROR"
  )
}

function subtractDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() - days)
  return next
}

function formatDateOnly(date: Date) {
  return date.toISOString().split("T")[0]!
}

function parseSince(rawSince: string | null) {
  const fallback = formatDateOnly(subtractDays(new Date(), DEFAULT_SINCE_DAYS))

  if (!rawSince) {
    return fallback
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawSince)) {
    return fallback
  }

  return rawSince
}

function toMySqlDateTime(dateOnly: string) {
  return `${dateOnly} 00:00:00`
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
  const lineId = url.searchParams.get("lineId")

  try {
    if (!table) {
      const tables = await fetchTableList({ schema, includeSystem })
      return NextResponse.json({ tables })
    }

    const since = parseSince(url.searchParams.get("since"))
    const sinceDateTime = toMySqlDateTime(since)
    const identifierParts = sanitizeTableIdentifier(table)
    const placeholder = buildTablePlaceholder(identifierParts)

    const hasLineFilter = typeof lineId === "string" && lineId.length > 0
    const baseParams: unknown[] = [...identifierParts]
    let appliedLineId: string | null = null
    let appliedSince: string | null = since
    let rows: Array<Record<string, unknown>>

    try {
      const filters: string[] = ["created_at >= ?"]
      const params = [...baseParams, sinceDateTime]

      if (hasLineFilter) {
        filters.push("line_id = ?")
        params.push(lineId!)
      }

      const whereClause = ` WHERE ${filters.join(" AND ")} `
      rows = await runQuery<Array<Record<string, unknown>>>(
        `SELECT * FROM ${placeholder}${whereClause}ORDER BY created_at DESC`,
        params
      )
      appliedLineId = hasLineFilter ? lineId! : null
    } catch (error) {
      if (hasLineFilter && isUnknownColumnError(error)) {
        try {
          rows = await runQuery<Array<Record<string, unknown>>>(
            `SELECT * FROM ${placeholder} WHERE created_at >= ? ORDER BY created_at DESC`,
            [...baseParams, sinceDateTime]
          )
          appliedLineId = null
        } catch (innerError) {
          if (isUnknownColumnError(innerError)) {
            rows = await runQuery<Array<Record<string, unknown>>>(
              `SELECT * FROM ${placeholder} LIMIT ?`,
              [...baseParams, FALLBACK_ROW_LIMIT]
            )
            appliedLineId = null
            appliedSince = null
          } else {
            throw innerError
          }
        }
      } else if (isUnknownColumnError(error)) {
        rows = await runQuery<Array<Record<string, unknown>>>(
          `SELECT * FROM ${placeholder} LIMIT ?`,
          [...baseParams, FALLBACK_ROW_LIMIT]
        )
        appliedLineId = hasLineFilter ? null : appliedLineId
        appliedSince = null
      } else {
        throw error
      }
    }

    const normalizedRows = normalizeRows(rows)
    const columns =
      normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : []

    return NextResponse.json({
      table: identifierParts.join("."),
      since: appliedSince,
      rowCount: normalizedRows.length,
      columns,
      rows: normalizedRows,
      lineId: appliedLineId,
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
