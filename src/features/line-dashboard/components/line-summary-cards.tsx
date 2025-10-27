import {
  IconAlertTriangle,
  IconCircleCheck,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { LineSummary, LineTrendPoint } from "../types"

type LineSummaryCardsProps = {
  lineId: string
  summary: LineSummary
  trend: LineTrendPoint[]
}

const numberFormatter = new Intl.NumberFormat()

const formatDelta = (delta: number) => {
  if (delta === 0) return "0"
  return delta > 0 ? `+${numberFormatter.format(delta)}` : numberFormatter.format(delta)
}

export function LineSummaryCards({ lineId, summary, trend }: LineSummaryCardsProps) {
  const sortedTrend = [...trend].sort((a, b) => a.date.localeCompare(b.date))
  const latestPoint = sortedTrend.at(-1)
  const previousPoint = sortedTrend.at(-2)

  const activeDelta =
    latestPoint && previousPoint
      ? latestPoint.activeCount - previousPoint.activeCount
      : 0
  const completedDelta =
    latestPoint && previousPoint
      ? latestPoint.completedCount - previousPoint.completedCount
      : 0

  const completionRate =
    summary.totalCount > 0
      ? Math.round((summary.completedCount / summary.totalCount) * 100)
      : 0
  const jiraSentCount = Math.max(summary.completedCount - summary.pendingJiraCount, 0)

  return (
    <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-3 lg:px-6">
      <Card className="h-full bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card">
        <CardHeader>
          <CardDescription>Total Records · {lineId}</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {numberFormatter.format(summary.totalCount)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              {activeDelta >= 0 ? <IconTrendingUp /> : <IconTrendingDown />}
              {formatDelta(activeDelta)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            Current active items: {numberFormatter.format(latestPoint?.activeCount ?? summary.activeCount)}
          </div>
          <p>Tracks total SOP records captured for the selected line.</p>
        </CardFooter>
      </Card>

      <Card className="h-full bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card">
        <CardHeader>
          <CardDescription>Lots Completed</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {numberFormatter.format(summary.completedCount)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              <IconCircleCheck />
              {completionRate}% done
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            Change vs last day {formatDelta(completedDelta)}
          </div>
          <p>{numberFormatter.format(summary.lotCount)} distinct lots processed overall.</p>
        </CardFooter>
      </Card>

      <Card className="h-full bg-gradient-to-t from-primary/5 to-card shadow-xs dark:bg-card">
        <CardHeader>
          <CardDescription>Pending Jira Dispatch</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {numberFormatter.format(summary.pendingJiraCount)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              <IconAlertTriangle />
              Needs attention
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            Jira sent: {numberFormatter.format(jiraSentCount)}
          </div>
          <p>Open items where Jira has not been dispatched yet.</p>
        </CardFooter>
      </Card>
    </div>
  )
}
