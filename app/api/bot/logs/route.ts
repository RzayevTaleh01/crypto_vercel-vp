import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { getBotLogs } = await import("@/lib/trading-bot")
    const logs = await getBotLogs()
    return NextResponse.json(logs || [])
  } catch (error) {
    console.error("Logs xətası:", error)
    return NextResponse.json([])
  }
}
