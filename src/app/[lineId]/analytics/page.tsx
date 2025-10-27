import * as React from "react"
import { notFound } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  LineActivityChart,
  LineSummaryCards,
} from "@/features/line-dashboard/components"
import { getLineDashboard } from "@/features/line-dashboard/api"

type LineDashboardPageProps = {
  params: Promise<{
    lineId: string
  }>
}

export default async function LineDashboardPage({ params }: LineDashboardPageProps) {
  const { lineId: rawLineId } = await params
  const decodedLineId = decodeURIComponent(rawLineId)
  const dashboard = await getLineDashboard(decodedLineId)

  if (!dashboard) {
    notFound()
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" currentLine={dashboard.lineId} />
      <SidebarInset>
        <SiteHeader lineId={dashboard.lineId} lastUpdatedAt={dashboard.summary.latestUpdatedAt} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-4 md:py-4">
              <LineSummaryCards lineId={dashboard.lineId} summary={dashboard.summary} trend={dashboard.trend} />
              <LineActivityChart lineId={dashboard.lineId} trend={dashboard.trend} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
