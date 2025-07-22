import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const config = await request.json()
    const { startBot } = await import("@/lib/trading-bot")
    const result = await startBot(config)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Bot başlama xətası:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Bot başlaya bilmədi",
        details: error instanceof Error ? error.message : "Naməlum xəta",
      },
      { status: 500 },
    )
  }
}
