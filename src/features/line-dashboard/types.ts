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
