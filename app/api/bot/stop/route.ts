import { NextResponse } from "next/server"

export async function POST() {
  try {
    const { stopBot } = await import("@/lib/trading-bot")
    const result = await stopBot()
    return NextResponse.json(result)
  } catch (error) {
    console.error("Bot dayandırma xətası:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Bot dayandırıla bilmədi",
        details: error instanceof Error ? error.message : "Naməlum xəta",
      },
      { status: 500 },
    )
  }
}
