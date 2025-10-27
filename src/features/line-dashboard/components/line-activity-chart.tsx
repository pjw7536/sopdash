"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { LineTrendPoint } from "../types"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type LineActivityChartProps = {
  lineId: string
  trend: LineTrendPoint[]
}

const chartConfig = {
  activeCount: { label: "Active", color: "var(--primary)" },
  completedCount: { label: "Completed", color: "var(--chart-4)" },
} satisfies ChartConfig

const numberFormatter = new Intl.NumberFormat()

export function LineActivityChart({ lineId, trend }: LineActivityChartProps) {
  const [timeRange, setTimeRange] = React.useState<"90d" | "30d" | "7d">("90d")

  const sortedTrend = React.useMemo(
    () => [...trend].sort((a, b) => a.date.localeCompare(b.date)),
    [trend]
  )
  const latestDate = sortedTrend.at(-1)?.date

  const filteredData = React.useMemo(() => {
    if (!sortedTrend.length) return []

    const dayWindow = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const referenceDate = latestDate ? new Date(latestDate) : new Date()
    const startDate = new Date(referenceDate)
    startDate.setDate(referenceDate.getDate() - (dayWindow - 1))

    return sortedTrend.filter((point) => {
      const pointDate = new Date(point.date)
      return pointDate >= startDate && pointDate <= referenceDate
    })
  }, [sortedTrend, latestDate, timeRange])

  const hasData = filteredData.length > 0

  return (
    <Card className="mx-4 flex h-full flex-col lg:mx-6">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold">
            Line activity · {lineId}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Completion and in-progress breakdown
          </p>
        </div>
        <Select value={timeRange} onValueChange={(value) => setTimeRange(value as typeof timeRange)}>
          <SelectTrigger className="w-40" size="sm" aria-label="Select time range">
            <SelectValue placeholder="Last 90 days" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="90d" className="rounded-lg">
              Last 90 days
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="h-[260px] px-0 pb-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-activeCount)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-activeCount)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-completedCount)" stopOpacity={0.7} />
                <stop offset="95%" stopColor="var(--color-completedCount)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(value) => numberFormatter.format(value as number)}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    return Number.isNaN(date.getTime())
                      ? value
                      : date.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })
                  }}
                  formatter={(value, name) => [
                    numberFormatter.format(value as number),
                    name === "completedCount" ? "Completed" : "Active",
                  ]}
                />
              }
            />
            <Area
              dataKey="activeCount"
              name="Active"
              type="monotone"
              fill="url(#fillActive)"
              stroke="var(--color-activeCount)"
              strokeWidth={2}
              stackId="line-trend"
            />
            <Area
              dataKey="completedCount"
              name="Completed"
              type="monotone"
              fill="url(#fillCompleted)"
              stroke="var(--color-completedCount)"
              strokeWidth={2}
              stackId="line-trend"
            />
          </AreaChart>
        </ChartContainer>
        {!hasData ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No trend data available for this range.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
