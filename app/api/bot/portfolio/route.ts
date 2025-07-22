import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { getOpenTrades } = await import("@/lib/trading-bot")
    const portfolio = await getOpenTrades()
    return NextResponse.json(portfolio || [])
  } catch (error) {
    console.error("Portfolio xətası:", error)
    return NextResponse.json([])
  }
}
