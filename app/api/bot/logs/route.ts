import { NextResponse } from "next/server"

export async function GET() {
  try {
    const { getBotLogs } = await import("@/lib/trading-bot")
    const logs = await getBotLogs()
    return NextResponse.json(logs || [])
  } catch (error: any) {
    console.error("Logs API xətası:", error)
    return NextResponse.json([])
  }
}