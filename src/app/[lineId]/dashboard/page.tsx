import * as React from "react"
import { notFound } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { getLineDashboard } from "@/lib/lines"

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
              <SectionCards lineId={dashboard.lineId} summary={dashboard.summary} trend={dashboard.trend} />
              <DataTable lineId={dashboard.lineId} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
