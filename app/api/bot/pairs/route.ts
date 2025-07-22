import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { getCurrentTradingPairs, getPairSelectionStats } = await import("@/lib/trading-bot")

    const currentPairs = await getCurrentTradingPairs()
    const stats = await getPairSelectionStats()

    return NextResponse.json({
      success: true,
      currentPairs,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Pairs API xətası:", error)
    return NextResponse.json({
      success: false,
      error: error.message,
      currentPairs: [],
      stats: null,
    })
  }
}

export async function POST() {
  try {
    const { refreshTradingPairs } = await import("@/lib/trading-bot")

    const newPairs = await refreshTradingPairs()

    return NextResponse.json({
      success: true,
      message: "Trading pairs yeniləndi",
      newPairs,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Pairs refresh xətası:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
