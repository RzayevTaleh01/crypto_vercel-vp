import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { getBotStats } = await import("@/lib/trading-bot")
    const stats = await getBotStats()
    return NextResponse.json({ ...stats, status: "success" })
  } catch (error) {
    console.error("Stats xətası:", error)
    return NextResponse.json({
      totalCapital: 20,
      tradingCapital: 2,
      totalProfit: 0,
      isRunning: false,
      tradesCount: 0,
      winRate: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      status: "error",
      error: error.message,
    })
  }
}
