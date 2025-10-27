import { NextResponse } from "next/server"

import { getLineDashboard } from "@/features/line-dashboard/api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: {
    lineId: string
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const rawLineId = context.params.lineId
    const lineId = decodeURIComponent(rawLineId)
    const dashboard = await getLineDashboard(lineId)

    if (!dashboard) {
      return NextResponse.json(
        { error: `Line ${lineId} was not found.` },
        { status: 404 }
      )
    }

    return NextResponse.json(dashboard)
  } catch (error) {
    console.error("Failed to load line dashboard", error)
    return NextResponse.json(
      { error: "Failed to load line dashboard" },
      { status: 500 }
    )
  }
}
