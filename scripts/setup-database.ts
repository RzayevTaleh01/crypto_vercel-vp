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

    // Create tables one by one
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

    for (const table of tables) {
      try {
        await sql([table.sql])
        console.log(`✅ Created table: ${table.name}`)
      } catch (error) {
        console.warn(`⚠️ Table ${table.name}:`, error.message)
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
    } catch (error) {
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

    process.exit(0)
  } catch (error) {
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
