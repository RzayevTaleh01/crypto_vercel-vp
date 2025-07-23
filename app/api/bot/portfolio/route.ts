import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { getOpenTrades } = await import("@/lib/trading-bot")
    const portfolio = await getOpenTrades()
    return NextResponse.json(portfolio || [])
  } catch (error: any) {
    console.error("Portfolio API xətası:", error)
    return NextResponse.json([])
  }
}