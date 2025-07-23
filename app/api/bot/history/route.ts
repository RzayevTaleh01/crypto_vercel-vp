import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { getTradeHistory } = await import("@/lib/trading-bot")
    const history = await getTradeHistory()
    return NextResponse.json(history || [])
  } catch (error) {
    console.error("Trade history xətası:", error)
    return NextResponse.json([], { status: 500 })
  }
}