import { NextResponse } from "next/server"

import { getDistinctLineIds } from "@/lib/lines"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const lines = await getDistinctLineIds()
    return NextResponse.json({ lines })
  } catch (error) {
    console.error("Failed to load line list", error)
    return NextResponse.json(
      { error: "Failed to load line list" },
      { status: 500 }
    )
  }
}
