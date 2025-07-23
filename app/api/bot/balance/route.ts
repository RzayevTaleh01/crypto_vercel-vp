import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { getBotStats } = await import("@/lib/trading-bot")
    const stats = await getBotStats()
    return NextResponse.json({ ...stats, status: "success" })
  } catch (error) {
    console.error("Stats xətası:", error)
    return NextResponse.json({
      totalCapital: 100,
      tradingCapital: 10,
      totalProfit: 0,
      isRunning: false,
      tradesCount: 0,
      winRate: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      dailyLoss: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Naməlum xəta",
    })
  }
}
