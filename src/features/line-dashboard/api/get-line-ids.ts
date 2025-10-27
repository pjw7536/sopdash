import { runQuery } from "@/lib/db"

const DEFAULT_TABLE_NAME = "drone_sop_v3"

type RawLineIdRow = {
  line_id: string | null
}

export async function getDistinctLineIds() {
  const rows = await runQuery<RawLineIdRow[]>(
    `
      SELECT DISTINCT line_id
      FROM ${DEFAULT_TABLE_NAME}
      WHERE line_id IS NOT NULL AND line_id <> ''
      ORDER BY line_id
    `
  )

  return rows
    .map((row) => row.line_id)
    .filter((lineId): lineId is string => typeof lineId === "string" && lineId.length > 0)
}
