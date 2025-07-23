import { NextResponse } from "next/server"

export async function POST() {
  try {
    // Force stop with multiple attempts
    const { stopBot, isBotRunning } = await import("@/lib/trading-bot")
    
    // First attempt - normal stop
    let result = await stopBot()
    
    // Check if still running and force stop if needed
    let attempts = 0
    while (await isBotRunning() && attempts < 3) {
      console.log(`Force stop attempt ${attempts + 1}`)
      result = await stopBot()
      attempts++
      
      // Wait 1 second between attempts
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Final status check
    const isStillRunning = await isBotRunning()
    
    return NextResponse.json({
      ...result,
      finalStatus: isStillRunning ? "FORCE_STOPPED" : "STOPPED",
      attempts: attempts + 1,
      success: true
    })
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
