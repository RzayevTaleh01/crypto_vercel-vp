import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { isBotRunning } = await import("@/lib/trading-bot")

    // Test all connections
    const status = {
      bot: {
        running: isBotRunning(),
        status: isBotRunning() ? "active" : "stopped",
      },
      database: {
        status: "unknown",
        connected: false,
      },
      binance: {
        status: "unknown",
        connected: false,
      },
      telegram: {
        status: "unknown",
        configured: false,
      },
    }

    // Test database
    try {
      const { NeonDatabaseService } = await import("@/lib/neon-database-service")
      const db = new NeonDatabaseService()
      const healthy = await db.healthCheck()
      status.database = {
        status: healthy ? "connected" : "error",
        connected: healthy,
      }
    } catch (error) {
      status.database = {
        status: "error",
        connected: false,
      }
    }

    // Test Binance
    try {
      const { BinanceTestnetService } = await import("@/lib/binance-testnet-service")
      const binance = new BinanceTestnetService()
      const connected = await binance.testConnection()
      status.binance = {
        status: connected ? "connected" : "disconnected",
        connected,
      }
    } catch (error) {
      status.binance = {
        status: "error",
        connected: false,
      }
    }

    // Check Telegram config
    status.telegram = {
      status: process.env.TELEGRAM_BOT_TOKEN ? "configured" : "not-configured",
      configured: !!process.env.TELEGRAM_BOT_TOKEN,
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...status,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
