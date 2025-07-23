import { NextResponse } from "next/server"

export async function POST() {
  try {
    const { stopBot, isBotRunning } = await import("@/lib/trading-bot")
    
    // Check current status first
    let isCurrentlyRunning = false
    try {
      isCurrentlyRunning = await isBotRunning()
    } catch (statusError) {
      console.warn("Status check failed, proceeding with stop attempt:", statusError)
    }
    
    if (!isCurrentlyRunning) {
      return NextResponse.json({
        success: true,
        message: "Bot artıq dayandırılıb",
        wasRunning: false,
        finalStatus: "ALREADY_STOPPED"
      })
    }
    
    // Multiple stop attempts with increasing delays
    let result
    let attempts = 0
    const maxAttempts = 3
    
    for (attempts = 0; attempts < maxAttempts; attempts++) {
      try {
        console.log(`Stop attempt ${attempts + 1}/${maxAttempts}`)
        result = await stopBot()
        
        // Wait a bit before checking status
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Check if successfully stopped
        const stillRunning = await isBotRunning()
        if (!stillRunning) {
          console.log(`Bot successfully stopped on attempt ${attempts + 1}`)
          break
        }
        
        if (attempts < maxAttempts - 1) {
          console.log(`Bot still running, waiting before retry...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (stopError) {
        console.error(`Stop attempt ${attempts + 1} failed:`, stopError)
        if (attempts === maxAttempts - 1) {
          throw stopError
        }
      }
    }
    
    // Final status check
    let finalStatus = "STOPPED"
    try {
      const isStillRunning = await isBotRunning()
      finalStatus = isStillRunning ? "FORCE_STOPPED_PARTIAL" : "STOPPED"
    } catch (finalCheckError) {
      console.warn("Final status check failed:", finalCheckError)
      finalStatus = "STOPPED_STATUS_UNKNOWN"
    }
    
    return NextResponse.json({
      success: true,
      message: "Bot dayandırma prosesi tamamlandı",
      wasRunning: true,
      finalStatus,
      attempts: attempts + 1,
      result
    })
    
  } catch (error) {
    console.error("Bot dayandırma kritik xətası:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Bot dayandırıla bilmədi",
        details: error instanceof Error ? error.message : "Naməlum xəta",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
