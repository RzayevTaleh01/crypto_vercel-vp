import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { getTradeHistory } = await import("@/lib/trading-bot")
    const history = await getTradeHistory()
    return NextResponse.json(history || [])
  } catch (error: any) {
    console.error("History API xətası:", error)
    return NextResponse.json([])
  }
}