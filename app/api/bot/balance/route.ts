import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { getBotStats } = await import("@/lib/trading-bot")
    const stats = await getBotStats()
    return NextResponse.json(stats)
  } catch (error: any) {
    console.error("Balance API xətası:", error)
    return NextResponse.json(
      { 
        error: "Stats alına bilmədi",
        details: error.message || "Naməlum xəta",
        totalCapital: 20,
        tradingCapital: 2,
        totalProfit: 0,
        isRunning: false,
        tradesCount: 0,
        winRate: 0,
        maxDrawdown: 0
      },
      { status: 200 }
    )
  }
}