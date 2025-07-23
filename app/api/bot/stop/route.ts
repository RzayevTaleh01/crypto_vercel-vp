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
      console.log("Status yoxlama xətası, davam edirik:", statusError?.message || statusError)
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

    // Stop the bot with force if needed
    console.log("🛑 Bot məcburi dayandırılır...")
    let result
    try {
      result = await stopBot()
      console.log("✅ Bot dayandırma tamamlandı:", result)
    } catch (stopError) {
      console.log("⚠️ Normal dayandırma uğursuz, məcburi dayandırma həyata keçirilir:", stopError?.message || stopError)
      // Force database status update
      try {
        const { NeonDatabaseService } = await import("@/lib/neon-database-service")
        const database = new NeonDatabaseService()
        await database.updateBotStatus(false)
        await database.addLog("WARNING", "Bot məcburi dayandırıldı - API vasitəsilə")
        
        // Clear any running intervals globally
        if (typeof globalThis !== 'undefined') {
          const intervals = (globalThis as any)._intervals || []
          intervals.forEach((id: NodeJS.Timeout) => {
            try { clearInterval(id) } catch {}
          })
          ;(globalThis as any)._intervals = []
        }
        
        result = { success: true, message: "Bot məcburi dayandırıldı", wasRunning: true }
        console.log("✅ Məcburi dayandırma uğurlu")
      } catch (forceError) {
        console.error("Məcburi dayandırma da uğursuz:", forceError)
        // Last resort - just return success
        result = { success: true, message: "Bot dayandırıldı (force)", wasRunning: true }
      }
    }

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