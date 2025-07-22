
import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function GET(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          status: "error",
          database: "not_configured",
          message: "DATABASE_URL environment variable yoxdur",
        },
        { status: 503 }
      )
    }

    const sql = neon(process.env.DATABASE_URL)
    
    // Test database connection
    await sql`SELECT 1`
    
    // Check if tables exist
    const tablesExist = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('bot_stats', 'trades', 'system_logs')
    `

    const tableCount = Number(tablesExist[0]?.count || 0)

    if (tableCount >= 3) {
      return NextResponse.json({
        status: "healthy",
        database: "connected",
        message: "Database aktiv və cədvəllər mövcuddur",
        tables: tableCount
      })
    } else {
      return NextResponse.json({
        status: "warning",
        database: "tables_missing",
        message: "Database bağlıdır amma bəzi cədvəllər yoxdur",
        tables: tableCount
      })
    }

  } catch (error: any) {
    console.error("Database health check failed:", error)
    return NextResponse.json(
      {
        status: "error",
        database: "connection_failed",
        message: `Database bağlantı xətası: ${error.message}`,
      },
      { status: 503 }
    )
  }
}
