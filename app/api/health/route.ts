import { NextResponse } from "next/server"

export async function GET() {
  const healthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      enhanced: "unknown",
      simple: "unknown",
      database: "unknown",
    },
  }

  // Test simple service
  try {
    const { getSimpleBotStats } = await import("@/lib/simple-bot-manager")
    const simpleStats = await getSimpleBotStats()
    healthStatus.services.simple = "working"
  } catch (error) {
    healthStatus.services.simple = "error"
  }

  // Test enhanced service
  try {
    const { getBotStats } = await import("@/lib/enhanced-bot-manager")
    const enhancedStats = await getBotStats()
    healthStatus.services.enhanced = "working"
    healthStatus.services.database = "connected"
  } catch (error) {
    healthStatus.services.enhanced = "error"
    healthStatus.services.database = "error"
  }

  return NextResponse.json(healthStatus)
}
