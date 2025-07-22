
import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          success: false,
          error: "DATABASE_URL environment variable yoxdur. .env.local faylına əlavə edin.",
        },
        { status: 400 }
      )
    }

    const sql = neon(process.env.DATABASE_URL)

    // Test connection
    await sql`SELECT 1`

    // Create tables
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
            quantity VARCHAR(50) NOT NULL,
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
      } catch (error: any) {
        console.warn(`Table ${table.name} creation warning:`, error.message)
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
    }

    return NextResponse.json({
      success: true,
      message: "Database uğurla hazırlandı",
      tables: createdTables,
    })

  } catch (error: any) {
    console.error("Database init error:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Database init xətası: ${error.message}`,
      },
      { status: 500 }
    )
  }
}
