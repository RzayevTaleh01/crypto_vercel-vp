
import { neon } from "@neondatabase/serverless"

async function cleanDatabase() {
  console.log("🧹 Cleaning database...")

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required")
    process.exit(1)
  }

  const sql = neon(process.env.DATABASE_URL)

  try {
    console.log("🔗 Testing database connection...")
    await sql`SELECT 1`
    console.log("✅ Database connection successful")

    // Drop all tables if they exist
    const tables = [
      'account_balances',
      'daily_performance', 
      'price_history',
      'market_data',
      'system_logs',
      'bot_config',
      'trades',
      'bot_stats'
    ]

    console.log("🗑️ Dropping existing tables...")
    for (const table of tables) {
      try {
        await sql`DROP TABLE IF EXISTS ${sql(table)} CASCADE`
        console.log(`✅ Dropped table: ${table}`)
      } catch (error: any) {
        console.warn(`⚠️ Could not drop table ${table}:`, error.message)
      }
    }

    console.log("✅ Database cleaned successfully!")
    process.exit(0)
  } catch (error: any) {
    console.error("❌ Database cleanup failed:", error.message)
    process.exit(1)
  }
}

cleanDatabase()
