import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { getOpenTrades } = await import("@/lib/trading-bot")
    const trades = await getOpenTrades()
    return NextResponse.json(trades || [])
  } catch (error) {
    console.error("Portfolio xətası:", error)
    return NextResponse.json([], { status: 500 })
  }
}