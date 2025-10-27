import { runQuery } from "@/lib/db"

export type LineSummary = {
  totalCount: number
  activeCount: number
  completedCount: number
  pendingJiraCount: number
  lotCount: number
  latestUpdatedAt: string | null
}

export type LineTrendPoint = {
  date: string
  activeCount: number
  completedCount: number
}

export type LineRecentItem = {
  id: number
  lotId: string | null
  status: string | null
  createdAt: string
}

export type LineDashboardData = {
  lineId: string
  summary: LineSummary
  trend: LineTrendPoint[]
  recent: LineRecentItem[]
}

const DEFAULT_TABLE_NAME = "drone_sop_v3"
const TREND_LOOKBACK_DAYS = 90
const RECENT_LIMIT = 10

type RawLineIdRow = {
  line_id: string | null
}

type RawSummaryRow = {
  totalCount: number | string | null
  activeCount: number | string | null
  completedCount: number | string | null
  pendingJiraCount: number | string | null
  lotCount: number | string | null
  latestUpdatedAt: Date | null
}

type RawTrendRow = {
  day: string | Date
  activeCount: number | string | null
  completedCount: number | string | null
}

type RawRecentRow = {
  id: number
  lot_id: string | null
  status: string | null
  created_at: Date | null
}

const toISODate = (input: string | Date | null) => {
  if (!input) return null
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
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

export async function getLineDashboard(lineId: string): Promise<LineDashboardData | null> {
  const [summaryRow] = await runQuery<RawSummaryRow[]>(
    `
      SELECT
        COUNT(*) AS totalCount,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completedCount,
        SUM(CASE WHEN status <> 'Completed' THEN 1 ELSE 0 END) AS activeCount,
        SUM(CASE WHEN send_jira = 0 AND needtosend = 1 THEN 1 ELSE 0 END) AS pendingJiraCount,
        COUNT(DISTINCT lot_id) AS lotCount,
        MAX(updated_at) AS latestUpdatedAt
      FROM ${DEFAULT_TABLE_NAME}
      WHERE line_id = ?
    `,
    [lineId]
  )

  if (!summaryRow || summaryRow.totalCount === 0) {
    return null
  }

  const trendRows = await runQuery<RawTrendRow[]>(
    `
      SELECT
        DATE(created_at) AS day,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completedCount,
        SUM(CASE WHEN status <> 'Completed' THEN 1 ELSE 0 END) AS activeCount
      FROM ${DEFAULT_TABLE_NAME}
      WHERE line_id = ? AND created_at IS NOT NULL
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `,
    [lineId, TREND_LOOKBACK_DAYS]
  )

  const recentRows = await runQuery<RawRecentRow[]>(
    `
      SELECT
        id,
        lot_id,
        status,
        created_at
      FROM ${DEFAULT_TABLE_NAME}
      WHERE line_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [lineId, RECENT_LIMIT]
  )

  return {
    lineId,
    summary: {
      totalCount: Number(summaryRow.totalCount ?? 0),
      activeCount: Number(summaryRow.activeCount ?? 0),
      completedCount: Number(summaryRow.completedCount ?? 0),
      pendingJiraCount: Number(summaryRow.pendingJiraCount ?? 0),
      lotCount: Number(summaryRow.lotCount ?? 0),
      latestUpdatedAt: toISODate(summaryRow.latestUpdatedAt),
    },
    trend: trendRows.map((row) => ({
      date: toISODate(row.day)?.slice(0, 10) ?? "",
      activeCount: Number(row.activeCount ?? 0),
      completedCount: Number(row.completedCount ?? 0),
    })),
    recent: recentRows.map((row) => ({
      id: row.id,
      lotId: row.lot_id ?? null,
      status: row.status ?? null,
      createdAt: toISODate(row.created_at) ?? "",
    })),
  }
}
