
import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

// Load environment variables from .env.local
config({ path: ".env.local" })

async function testConnection() {
  console.log("🔗 Testing database connection...")
  
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable not found")
    console.log("Current env vars:", Object.keys(process.env).filter(key => key.includes('DATABASE')))
    process.exit(1)
  }

  console.log("✅ DATABASE_URL found")
  console.log("🔗 Connecting to database...")

  try {
    const sql = neon(process.env.DATABASE_URL)
    const result = await sql`SELECT NOW() as current_time, version() as db_version`
    
    console.log("✅ Database connection successful!")
    console.log("📅 Current time:", result[0].current_time)
    console.log("🗄️ Database version:", result[0].db_version)
    
    process.exit(0)
  } catch (error: any) {
    console.error("❌ Database connection failed:", error.message)
    console.log("\n🔧 Check:")
    console.log("1. DATABASE_URL is correct in .env.local")
    console.log("2. Neon project is active")
    console.log("3. Network connection is working")
    process.exit(1)
  }
}

testConnection()
