import { NextResponse } from "next/server"

export async function POST() {
  try {
    console.log("🚀 Starting database initialization...")

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          success: false,
          error: "DATABASE_URL not configured",
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      )
    }

    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL)

    // Test connection
    await sql`SELECT 1`

    // Create essential tables
    const tables = [
      {
        name: "bot_stats",
        sql: `
          CREATE TABLE IF NOT EXISTS bot_stats (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            total_capital DECIMAL(18, 2) NOT NULL DEFAULT 20,
            trading_capital DECIMAL(18, 2) NOT NULL DEFAULT 2,
            total_profit DECIMAL(18, 2) DEFAULT 0,
            is_running BOOLEAN DEFAULT false,
            trades_count INTEGER DEFAULT 0,
            win_rate DECIMAL(5, 2) DEFAULT 0,
            max_drawdown DECIMAL(5, 2) DEFAULT 0,
            sharpe_ratio DECIMAL(8, 4) DEFAULT 0,
            daily_loss DECIMAL(18, 2) DEFAULT 0,
            last_reset_date DATE DEFAULT CURRENT_DATE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )
        `,
      },
      {
        name: "trades",
        sql: `
          CREATE TABLE IF NOT EXISTS trades (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            symbol VARCHAR(20) NOT NULL,
            type VARCHAR(4) NOT NULL CHECK (type IN ('BUY', 'SELL')),
            amount DECIMAL(18, 8) NOT NULL,
            price DECIMAL(18, 8) NOT NULL,
            quantity DECIMAL(18, 8) NOT NULL,
            profit DECIMAL(18, 8),
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            status VARCHAR(10) NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
            order_id BIGINT,
            fees DECIMAL(18, 8) DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )
        `,
      },
      {
        name: "system_logs",
        sql: `
          CREATE TABLE IF NOT EXISTS system_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            level VARCHAR(10) NOT NULL CHECK (level IN ('INFO', 'ERROR', 'WARNING', 'DEBUG')),
            message TEXT NOT NULL,
            details JSONB,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW()
          )
        `,
      },
    ]

    const createdTables = []
    for (const table of tables) {
      try {
        await sql([table.sql])
        createdTables.push(table.name)
        console.log(`✅ Created table: ${table.name}`)
      } catch (error) {
        console.warn(`⚠️ Table ${table.name}:`, error.message)
      }
    }

    // Initialize default stats
    const existingStats = await sql`SELECT id FROM bot_stats LIMIT 1`

    if (existingStats.length === 0) {
      await sql`
        INSERT INTO bot_stats (
          total_capital, trading_capital, total_profit, is_running, 
          trades_count, win_rate, max_drawdown, sharpe_ratio, daily_loss
        ) VALUES (20, 2, 0, false, 0, 0, 0, 0, 0)
      `
      console.log("✅ Initialized default bot stats")
    }

    // Get final stats
    const stats = await sql`SELECT * FROM bot_stats LIMIT 1`

    return NextResponse.json({
      success: true,
      message: "Database initialized successfully",
      createdTables,
      stats: stats[0] || null,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Database initialization failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Database initialization failed",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
