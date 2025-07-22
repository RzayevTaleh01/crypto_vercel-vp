import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Simple suggestions
    const suggestions = [
      { symbol: "BTCUSDT", reason: "Populyar trading cütü", change: 0 },
      { symbol: "ETHUSDT", reason: "Yüksək likvidlik", change: 0 },
      { symbol: "BNBUSDT", reason: "Exchange token", change: 0 },
      { symbol: "ADAUSDT", reason: "Güclü fundamentals", change: 0 },
      { symbol: "DOTUSDT", reason: "Ekosistem inkişafı", change: 0 },
    ]

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error("Suggestions xətası:", error)
    return NextResponse.json([])
  }
}
