
import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function POST() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          success: false,
          error: "DATABASE_URL environment variable tapılmadı",
        },
        { status: 500 }
      )
    }

    const sql = neon(process.env.DATABASE_URL)

    console.log("🚀 Database initialization başlayır...")

    // Test connection
    await sql`SELECT 1`
    console.log("✅ Database bağlantısı uğurlu")

    const createdTables: string[] = []

    // Create tables one by one
    console.log("📋 Creating tables...")

    // Bot stats table
    try {
      await sql`
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
      `
      console.log("✅ Created table: bot_stats")
      createdTables.push("bot_stats")
    } catch (error: any) {
      console.warn("⚠️ Table bot_stats:", error.message)
    }

    // Trades table
    try {
      await sql`
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
      `
      console.log("✅ Created table: trades")
      createdTables.push("trades")
    } catch (error: any) {
      console.warn("⚠️ Table trades:", error.message)
    }

    // Bot config table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS bot_config (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          initial_capital DECIMAL(18, 2) NOT NULL,
          trade_percentage DECIMAL(5, 2) NOT NULL,
          buy_threshold DECIMAL(5, 2) NOT NULL,
          sell_threshold DECIMAL(5, 2) NOT NULL,
          telegram_enabled BOOLEAN DEFAULT false,
          max_daily_loss DECIMAL(5, 2) DEFAULT 10,
          max_open_trades INTEGER DEFAULT 5,
          stop_loss_percentage DECIMAL(5, 2) DEFAULT 5,
          trading_pairs TEXT[] DEFAULT ARRAY['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
          use_rsi BOOLEAN DEFAULT true,
          use_macd BOOLEAN DEFAULT true,
          use_sma BOOLEAN DEFAULT true,
          is_active BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      console.log("✅ Created table: bot_config")
      createdTables.push("bot_config")
    } catch (error: any) {
      console.warn("⚠️ Table bot_config:", error.message)
    }

    // System logs table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS system_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          level VARCHAR(10) NOT NULL CHECK (level IN ('INFO', 'ERROR', 'WARNING', 'DEBUG')),
          message TEXT NOT NULL,
          details JSONB,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      console.log("✅ Created table: system_logs")
      createdTables.push("system_logs")
    } catch (error: any) {
      console.warn("⚠️ Table system_logs:", error.message)
    }

    // Market data table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS market_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          symbol VARCHAR(20) NOT NULL,
          price DECIMAL(18, 8) NOT NULL,
          price_change_percent DECIMAL(8, 4) NOT NULL,
          volume DECIMAL(20, 8) NOT NULL,
          high DECIMAL(18, 8) NOT NULL,
          low DECIMAL(18, 8) NOT NULL,
          open_price DECIMAL(18, 8) NOT NULL,
          bid_price DECIMAL(18, 8),
          ask_price DECIMAL(18, 8),
          rsi DECIMAL(8, 4),
          macd_signal VARCHAR(10),
          sma_signal VARCHAR(10),
          volatility DECIMAL(8, 4),
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      console.log("✅ Created table: market_data")
      createdTables.push("market_data")
    } catch (error: any) {
      console.warn("⚠️ Table market_data:", error.message)
    }

    // Price history table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS price_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          symbol VARCHAR(20) NOT NULL,
          open_price DECIMAL(18, 8) NOT NULL,
          high_price DECIMAL(18, 8) NOT NULL,
          low_price DECIMAL(18, 8) NOT NULL,
          close_price DECIMAL(18, 8) NOT NULL,
          volume DECIMAL(20, 8) NOT NULL,
          open_time TIMESTAMPTZ NOT NULL,
          close_time TIMESTAMPTZ NOT NULL,
          interval_type VARCHAR(10) NOT NULL DEFAULT '5m',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      console.log("✅ Created table: price_history")
      createdTables.push("price_history")
    } catch (error: any) {
      console.warn("⚠️ Table price_history:", error.message)
    }

    // Daily performance table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS daily_performance (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          date DATE NOT NULL UNIQUE,
          profit DECIMAL(18, 2) NOT NULL,
          total_capital DECIMAL(18, 2) NOT NULL,
          trades_count INTEGER NOT NULL,
          win_rate DECIMAL(5, 2) DEFAULT 0,
          max_drawdown DECIMAL(5, 2) DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      console.log("✅ Created table: daily_performance")
      createdTables.push("daily_performance")
    } catch (error: any) {
      console.warn("⚠️ Table daily_performance:", error.message)
    }

    // Account balances table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS account_balances (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          asset VARCHAR(10) NOT NULL,
          free DECIMAL(18, 8) NOT NULL,
          locked DECIMAL(18, 8) NOT NULL,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `
      console.log("✅ Created table: account_balances")
      createdTables.push("account_balances")
    } catch (error: any) {
      console.warn("⚠️ Table account_balances:", error.message)
    }

    // Create indexes
    console.log("📋 Creating indexes...")
    const indexes = [
      sql`CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)`,
      sql`CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)`,
      sql`CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)`,
      sql`CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol)`,
      sql`CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp)`,
      sql`CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol)`,
      sql`CREATE INDEX IF NOT EXISTS idx_price_history_open_time ON price_history(open_time)`,
      sql`CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp)`,
      sql`CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)`,
    ]

    for (const indexQuery of indexes) {
      try {
        await indexQuery
        console.log("✅ Created index")
      } catch (error: any) {
        console.warn("⚠️ Index creation:", error.message)
      }
    }

    // Initialize default stats
    console.log("📊 Initializing bot stats...")
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

    console.log("🎉 Database initialization tamamlandı!")

    return NextResponse.json({
      success: true,
      message: "Database uğurla hazırlandı və bütün tabllar yaradıldı",
      tables: createdTables,
      totalTables: createdTables.length,
    })

  } catch (error: any) {
    console.error("❌ Database init error:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Database init xətası: ${error.message}`,
        details: error.stack,
      },
      { status: 500 }
    )
  }
}
