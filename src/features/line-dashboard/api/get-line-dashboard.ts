import { runQuery } from "@/lib/db"
import type {
  LineDashboardData,
  LineRecentItem,
  LineSummary,
  LineTrendPoint,
} from "../types"

const DEFAULT_TABLE_NAME = "drone_sop_v3"
const TREND_LOOKBACK_DAYS = 90
const RECENT_LIMIT = 10

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

const mapSummaryRow = (row: RawSummaryRow): LineSummary => ({
  totalCount: Number(row.totalCount ?? 0),
  activeCount: Number(row.activeCount ?? 0),
  completedCount: Number(row.completedCount ?? 0),
  pendingJiraCount: Number(row.pendingJiraCount ?? 0),
  lotCount: Number(row.lotCount ?? 0),
  latestUpdatedAt: toISODate(row.latestUpdatedAt),
})

const mapTrendRows = (rows: RawTrendRow[]): LineTrendPoint[] =>
  rows.map((row) => ({
    date: toISODate(row.day)?.slice(0, 10) ?? "",
    activeCount: Number(row.activeCount ?? 0),
    completedCount: Number(row.completedCount ?? 0),
  }))

const mapRecentRows = (rows: RawRecentRow[]): LineRecentItem[] =>
  rows.map((row) => ({
    id: row.id,
    lotId: row.lot_id ?? null,
    status: row.status ?? null,
    createdAt: toISODate(row.created_at) ?? "",
  }))

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

  if (!summaryRow || Number(summaryRow.totalCount ?? 0) === 0) {
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
    summary: mapSummaryRow(summaryRow),
    trend: mapTrendRows(trendRows),
    recent: mapRecentRows(recentRows),
  }
}
