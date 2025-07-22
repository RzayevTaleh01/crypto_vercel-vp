import { NextResponse } from "next/server"

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          status: "error",
          database: "no-url",
          message: "DATABASE_URL not configured",
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      )
    }

    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL)

    // Test basic connection
    await sql`SELECT 1`

    // Test if bot_stats table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bot_stats'
      )
    `

    if (!tableCheck[0].exists) {
      return NextResponse.json({
        status: "needs-init",
        database: "connected",
        tables: "missing",
        message: "Database connected but tables need to be created",
        timestamp: new Date().toISOString(),
      })
    }

    // Try to get stats
    const stats = await sql`SELECT * FROM bot_stats LIMIT 1`

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      tables: "accessible",
      stats: stats.length > 0 ? stats[0] : null,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Database health check failed:", error)

    return NextResponse.json(
      {
        status: "error",
        database: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}
