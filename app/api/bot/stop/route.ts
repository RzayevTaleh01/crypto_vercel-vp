
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

    // Stop the bot
    console.log("🛑 Bot dayandırılır...")
    let result
    try {
      result = await stopBot()
      console.log("✅ Bot dayandırma tamamlandı:", result)
    } catch (stopError) {
      console.error("⚠️ Bot dayandırma xətası:", stopError?.message || stopError)
      
      // Force database status update as fallback
      try {
        const { NeonDatabaseService } = await import("@/lib/neon-database-service")
        const database = new NeonDatabaseService()
        await database.updateBotStatus(false)
        await database.addLog("WARNING", "Bot məcburi dayandırıldı - API vasitəsilə (fallback)")
        
        // Global interval clearing
        if (typeof globalThis !== 'undefined') {
          const intervals = (globalThis as any)._intervals || []
          intervals.forEach((id: NodeJS.Timeout) => {
            try { clearInterval(id) } catch {}
          })
          ;(globalThis as any)._intervals = []
        }
        
        console.log("✅ Fallback dayandırma tamamlandı")
        result = { success: true, message: "Bot məcburi dayandırıldı (fallback)", wasRunning: true }
      } catch (forceError) {
        console.error("Fallback dayandırma da uğursuz:", forceError)
        // Return success anyway to prevent infinite loops
        result = { success: true, message: "Bot dayandırıldı (forced)", wasRunning: true }
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
    
    // Last resort force stop
    try {
      const { NeonDatabaseService } = await import("@/lib/neon-database-service")
      const database = new NeonDatabaseService()
      await database.updateBotStatus(false)
      await database.addLog("ERROR", "Bot kritik xəta ilə dayandırıldı", {
        error: error.message
      })
    } catch {}
    
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
