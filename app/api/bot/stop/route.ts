import { NextResponse } from "next/server"

export async function POST() {
  try {
    console.log("🛑 Bot dayandırma API çağırıldı")

    const { stopBot, isBotRunning } = await import("@/lib/trading-bot")

    // Check if bot is running first
    let isCurrentlyRunning = false
    try {
      isCurrentlyRunning = await isBotRunning()
      console.log(`Bot hazırda işləyir: ${isCurrentlyRunning}`)
    } catch (statusError) {
      console.log("Status yoxlama xətası, davam edirik:", statusError.message)
    }

    // If not running, return success immediately
    if (!isCurrentlyRunning) {
      console.log("✅ Bot artıq dayandırılıb")
      return NextResponse.json({
        success: true,
        message: "Bot artıq dayandırılıb",
        wasRunning: false,
        timestamp: new Date().toISOString()
      })
    }

    // Stop the bot
    console.log("🛑 Bot dayandırılır...")
    const result = await stopBot()
    console.log("✅ Bot dayandırma tamamlandı:", result)

    return NextResponse.json({
      success: true,
      message: "Bot uğurla dayandırıldı",
      wasRunning: true,
      result,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error("🚨 Bot dayandırma kritik xətası:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Bot dayandırıla bilmədi",
        details: error.message || "Naməlum xəta",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}