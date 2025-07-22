
import { neon } from "@neondatabase/serverless"

async function setupDatabase() {
  console.log("🚀 Setting up Neon database...")

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required")
    console.log("Please add your Neon database URL to .env.local:")
    console.log("DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require")
    process.exit(1)
  }

  const sql = neon(process.env.DATABASE_URL)

  try {
    console.log("🔗 Testing database connection...")
    await sql`SELECT 1`
    console.log("✅ Database connection successful")

    console.log("📋 Creating tables...")

    // Create tables one by one with error handling
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
        name: "bot_config",
        sql: `
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
      {
        name: "market_data",
        sql: `
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
        `,
      },
    ]

    for (const table of tables) {
      try {
        await sql([table.sql])
        console.log(`✅ Created table: ${table.name}`)
      } catch (error: any) {
        console.warn(`⚠️ Table ${table.name}:`, error.message)
      }
    }

    // Create indexes
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)",
      "CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)",
      "CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)",
      "CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp)",
      "CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)",
    ]

    for (const indexSql of indexes) {
      try {
        await sql([indexSql])
        console.log("✅ Created index")
      } catch (error: any) {
        console.warn("⚠️ Index creation:", error.message)
      }
    }

    // Initialize default stats
    console.log("📊 Initializing bot stats...")
    try {
      const existingStats = await sql`SELECT id FROM bot_stats LIMIT 1`

      if (existingStats.length === 0) {
        await sql`
          INSERT INTO bot_stats (
            total_capital, trading_capital, total_profit, is_running, 
            trades_count, win_rate, max_drawdown, sharpe_ratio, daily_loss
          ) VALUES (20, 2, 0, false, 0, 0, 0, 0, 0)
        `
        console.log("✅ Initialized default bot stats")
      } else {
        console.log("✅ Bot stats already exist")
      }
    } catch (error: any) {
      console.warn("⚠️ Stats initialization:", error.message)
    }

    // Test the setup
    console.log("🧪 Testing setup...")
    const stats = await sql`SELECT * FROM bot_stats LIMIT 1`

    if (stats.length > 0) {
      console.log("✅ Database setup completed successfully!")
      console.log("📈 Current stats:", {
        totalCapital: Number(stats[0].total_capital),
        tradingCapital: Number(stats[0].trading_capital),
        isRunning: stats[0].is_running,
      })
    } else {
      throw new Error("Stats table is empty")
    }

    console.log("\n🎉 Database hazırdır! İndi botu işə sala bilərsiniz.")
    process.exit(0)
  } catch (error: any) {
    console.error("❌ Database setup failed:", error.message)
    console.log("\n🔧 Troubleshooting:")
    console.log("1. Check your DATABASE_URL in .env.local")
    console.log("2. Verify your Neon project is active")
    console.log("3. Ensure your IP is allowed (if IP restrictions are enabled)")
    console.log("4. Try running: npm run dev (then visit /api/db/init)")
    process.exit(1)
  }
}

setupDatabase()
