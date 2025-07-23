import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

// Load environment variables if not in Next.js runtime
if (typeof window === 'undefined' && !process.env.VERCEL) {
  config({ path: ".env.local" })
}

interface Trade {
  id: string
  symbol: string
  type: "BUY" | "SELL"
  amount: number
  price: number
  quantity: string
  profit?: number
  timestamp: string
  status: "OPEN" | "CLOSED"
  orderId?: number
  fees?: number
}

interface BotStats {
  totalCapital: number
  tradingCapital: number
  totalProfit: number
  isRunning: boolean
  tradesCount: number
  winRate: number
  maxDrawdown: number
  sharpeRatio: number
  dailyLoss: number
}

interface BotConfig {
  initialCapital: number
  tradePercentage: number
  buyThreshold: number
  sellThreshold: number
  telegramEnabled: boolean
  riskManagement: {
    maxDailyLoss: number
    maxOpenTrades: number
    stopLossPercentage: number
  }
  tradingPairs: string[]
  technicalIndicators: {
    useRSI: boolean
    useMACD: boolean
    useSMA: boolean
  }
}

interface MarketData {
  symbol: string
  price: number
  priceChangePercent: number
  volume: number
  high: number
  low: number
  openPrice: number
  bidPrice?: number
  askPrice?: number
  rsi?: number
  macdSignal?: string
  smaSignal?: string
  volatility?: number
}

interface PriceHistory {
  symbol: string
  openPrice: number
  highPrice: number
  lowPrice: number
  closePrice: number
  volume: number
  openTime: string
  closeTime: string
  intervalType: string
}

export class NeonDatabaseService {
  private sql: ReturnType<typeof neon>
  private initialized = false

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required")
    }
    this.sql = neon(process.env.DATABASE_URL)
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.init()
      this.initialized = true
    }
  }

  private async init() {
    try {
      // Test connection
      await this.sql`SELECT 1`
      console.log("✅ Connected to Neon database")

      // Check if tables exist and create them if they don't
      await this.ensureTablesExist()

      // Initialize default bot stats if not exists
      const existingStats = await this.sql`
        SELECT id FROM bot_stats LIMIT 1
      `

      if (existingStats.length === 0) {
        await this.sql`
          INSERT INTO bot_stats (
            total_capital, trading_capital, total_profit, is_running, 
            trades_count, win_rate, max_drawdown, sharpe_ratio, daily_loss
          ) VALUES (20, 2, 0, false, 0, 0, 0, 0, 0)
        `
        console.log("✅ Initialized default bot stats")
      }

      console.log("✅ Database initialization completed")
    } catch (error) {
      console.error("❌ Failed to initialize Neon database:", error)
      throw error
    }
  }

  private async ensureTablesExist() {
    try {
      // Check if bot_stats table exists
      const tableExists = await this.sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'bot_stats'
        )
      `

      if (!tableExists[0].exists) {
        console.log("📋 Tables don't exist, creating them...")
        await this.createTables()
      } else {
        console.log("✅ Database tables already exist")
      }
    } catch (error) {
      console.error("Error checking tables:", error)
      // Try to create tables anyway
      await this.createTables()
    }
  }

  private async createTables() {
    console.log("🔨 Creating database tables...")

    // Create each table individually with proper neon syntax
    console.log("📋 Creating trades table...")
    try {
      await this.sql`
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
    } catch (error: any) {
      console.warn("⚠️ Table trades creation failed:", error.message)
    }
      console.log("📋 Creating bot_config table...")
    try {
      await this.sql`
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
    } catch (error: any) {
      console.warn("⚠️ Table bot_config creation failed:", error.message)
    }
      console.log("📋 Creating bot_stats table...")
    try {
      await this.sql`
        CREATE TABLE IF NOT EXISTS bot_stats (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          total_capital DECIMAL(18, 2) NOT NULL,
          trading_capital DECIMAL(18, 2) NOT NULL,
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
    } catch (error: any) {
      console.warn("⚠️ Table bot_stats creation failed:", error.message)
    }
      console.log("📋 Creating system_logs table...")
    try {
      await this.sql`
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
    } catch (error: any) {
      console.warn("⚠️ Table system_logs creation failed:", error.message)
    }
      console.log("📋 Creating market_data table...")
    try {
      await this.sql`
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
    } catch (error: any) {
      console.warn("⚠️ Table market_data creation failed:", error.message)
    }
      console.log("📋 Creating price_history table...")
    try {
      await this.sql`
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
    } catch (error: any) {
      console.warn("⚠️ Table price_history creation failed:", error.message)
    }

    console.log("📋 Creating daily_performance table...")
    try {
      await this.sql`
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
    } catch (error: any) {
      console.warn("⚠️ Table daily_performance creation failed:", error.message)
    }

    console.log("📋 Creating account_balances table...")
    try {
      await this.sql`
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
    } catch (error: any) {
      console.warn("⚠️ Table account_balances creation failed:", error.message)
    }

    // Create indexes individually with proper syntax
    console.log("📋 Creating indexes...")

    try {
      await this.sql`CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)`
      console.log("✅ Created index: idx_trades_symbol")
    } catch (error: any) {
      console.warn("⚠️ Index idx_trades_symbol creation failed:", error.message)
    }

    try {
      await this.sql`CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)`
      console.log("✅ Created index: idx_trades_timestamp")
    } catch (error: any) {
      console.warn("⚠️ Index idx_trades_timestamp creation failed:", error.message)
    }

    try {
      await this.sql`CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)`
      console.log("✅ Created index: idx_trades_status")
    } catch (error: any) {
      console.warn("⚠️ Index idx_trades_status creation failed:", error.message)
    }

    try {
      await this.sql`CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol)`
      console.log("✅ Created index: idx_market_data_symbol")
    } catch (error: any) {
      console.warn("⚠️ Index idx_market_data_symbol creation failed:", error.message)
    }

    try {
      await this.sql`CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp)`
      console.log("✅ Created index: idx_market_data_timestamp")
    } catch (error: any) {
      console.warn("⚠️ Index idx_market_data_timestamp creation failed:", error.message)
    }

    try {
      await this.sql`CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol)`
      console.log("✅ Created index: idx_price_history_symbol")
    } catch (error: any) {
      console.warn("⚠️ Index idx_price_history_symbol creation failed:", error.message)
    }

    try {
      await this.sql`CREATE INDEX IF NOT EXISTS idx_price_history_open_time ON price_history(open_time)`
      console.log("✅ Created index: idx_price_history_open_time")
    } catch (error: any) {
      console.warn("⚠️ Index idx_price_history_open_time creation failed:", error.message)
    }

    try {
      await this.sql`CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp)`
      console.log("✅ Created index: idx_system_logs_timestamp")
    } catch (error: any) {
      console.warn("⚠️ Index idx_system_logs_timestamp creation failed:", error.message)
    }

    try {
      await this.sql`CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)`
      console.log("✅ Created index: idx_system_logs_level")  
    } catch (error: any) {
      console.warn("⚠️ Index idx_system_logs_level creation failed:", error.message)
    }

    // Create trigger function
    try {
      await this.sql`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql'
      `
      console.log("✅ Created trigger function")
    } catch (error) {
      console.warn("⚠️ Trigger function creation failed:", error.message)
    }

    // Create triggers individually with proper syntax
    console.log("📋 Creating triggers...")

    try {
      await this.sql`DROP TRIGGER IF EXISTS update_trades_updated_at ON trades`
      await this.sql`CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
                     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
      console.log("✅ Created trigger: update_trades_updated_at")
    } catch (error: any) {
      console.warn("⚠️ Trigger update_trades_updated_at creation failed:", error.message)
    }

    try {
      await this.sql`DROP TRIGGER IF EXISTS update_bot_config_updated_at ON bot_config`
      await this.sql`CREATE TRIGGER update_bot_config_updated_at BEFORE UPDATE ON bot_config
                     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
      console.log("✅ Created trigger: update_bot_config_updated_at")
    } catch (error: any) {
      console.warn("⚠️ Trigger update_bot_config_updated_at creation failed:", error.message)
    }

    try {
      await this.sql`DROP TRIGGER IF EXISTS update_bot_stats_updated_at ON bot_stats`
      await this.sql`CREATE TRIGGER update_bot_stats_updated_at BEFORE UPDATE ON bot_stats
                     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`
      console.log("✅ Created trigger: update_bot_stats_updated_at")
    } catch (error: any) {
      console.warn("⚠️ Trigger update_bot_stats_updated_at creation failed:", error.message)
    }

    console.log("✅ All database tables and indexes created successfully")
  }

  // Bot Configuration Methods
  async updateConfig(config: BotConfig) {
    await this.ensureInitialized()

    try {
      // Delete existing config and insert new one
      await this.sql`DELETE FROM bot_config WHERE is_active = true`

      await this.sql`
        INSERT INTO bot_config (
          initial_capital, trade_percentage, buy_threshold, sell_threshold,
          telegram_enabled, max_daily_loss, max_open_trades, stop_loss_percentage,
          trading_pairs, use_rsi, use_macd, use_sma, is_active
        ) VALUES (
          ${config.initialCapital}, ${config.tradePercentage}, ${config.buyThreshold}, ${config.sellThreshold},
          ${config.telegramEnabled}, ${config.riskManagement.maxDailyLoss}, ${config.riskManagement.maxOpenTrades}, 
          ${config.riskManagement.stopLossPercentage}, ${config.tradingPairs}, ${config.technicalIndicators.useRSI},
          ${config.technicalIndicators.useMACD}, ${config.technicalIndicators.useSMA}, true
        )
      `

      // Update bot stats
      const tradingCapital = (config.initialCapital * config.tradePercentage) / 100
      await this.sql`
        UPDATE bot_stats SET 
          total_capital = ${config.initialCapital},
          trading_capital = ${tradingCapital},
          updated_at = NOW()
      `

      await this.addLog("INFO", "Bot configuration updated", { config })
    } catch (error) {
      console.error("Error updating config:", error)
      throw error
    }
  }

  async getConfig(): Promise<BotConfig | null> {
    await this.ensureInitialized()

    try {
      const result = await this.sql`
        SELECT * FROM bot_config WHERE is_active = true ORDER BY created_at DESC LIMIT 1
      `

      if (result.length === 0) return null

      const config = result[0]
      return {
        initialCapital: Number(config.initial_capital),
        tradePercentage: Number(config.trade_percentage),
        buyThreshold: Number(config.buy_threshold),
        sellThreshold: Number(config.sell_threshold),
        telegramEnabled: config.telegram_enabled,
        riskManagement: {
          maxDailyLoss: Number(config.max_daily_loss),
          maxOpenTrades: config.max_open_trades,
          stopLossPercentage: Number(config.stop_loss_percentage),
        },
        tradingPairs: config.trading_pairs,
        technicalIndicators: {
          useRSI: config.use_rsi,
          useMACD: config.use_macd,
          useSMA: config.use_sma,
        },
      }
    } catch (error) {
      console.error("Error getting config:", error)
      return null
    }
  }

  // Bot Stats Methods
  async getStats(): Promise<BotStats> {
    await this.ensureInitialized()

    try {
      const result = await this.sql`
        SELECT * FROM bot_stats ORDER BY created_at DESC LIMIT 1
      `

      if (result.length === 0) {
        // Create default stats if none exist
        await this.sql`
          INSERT INTO bot_stats (
            total_capital, trading_capital, total_profit, is_running, 
            trades_count, win_rate, max_drawdown, sharpe_ratio, daily_loss
          ) VALUES (20, 2, 0, false, 0, 0, 0, 0, 0)
        `

        // Return default stats
        return {
          totalCapital: 20,
          tradingCapital: 2,
          totalProfit: 0,
          isRunning: false,
          tradesCount: 0,
          winRate: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          dailyLoss: 0,
        }
      }

      const stats = result[0]
      return {
        totalCapital: Number(stats.total_capital),
        tradingCapital: Number(stats.trading_capital),
        totalProfit: Number(stats.total_profit),
        isRunning: stats.is_running,
        tradesCount: stats.trades_count,
        winRate: Number(stats.win_rate),
        maxDrawdown: Number(stats.max_drawdown),
        sharpeRatio: Number(stats.sharpe_ratio),
        dailyLoss: Number(stats.daily_loss || 0),
      }
    } catch (error) {
      console.error("Error getting stats:", error)

      // Return fallback stats if database error
      return {
        totalCapital: 20,
        tradingCapital: 2,
        totalProfit: 0,
        isRunning: false,
        tradesCount: 0,
        winRate: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        dailyLoss: 0,
      }
    }
  }

  async updateBotStatus(isRunning: boolean) {
    await this.ensureInitialized()

    try {
      await this.sql`
        UPDATE bot_stats SET 
          is_running = ${isRunning},
          updated_at = NOW()
      `
    } catch (error) {
      console.error("Error updating bot status:", error)
      throw error
    }
  }

  async updateCapital(amount: number) {
    await this.ensureInitialized()

    try {
      const config = await this.getConfig()
      if (!config) throw new Error("No active config found")

      await this.sql`
        UPDATE bot_stats SET 
          total_capital = total_capital + ${amount},
          trading_capital = (total_capital + ${amount}) * ${config.tradePercentage} / 100,
          updated_at = NOW()
      `
    } catch (error) {
      console.error("Error updating capital:", error)
      throw error
    }
  }

  async addProfit(profit: number) {
    await this.ensureInitialized()

    try {
      await this.sql`
        UPDATE bot_stats SET 
          total_profit = total_profit + ${profit},
          updated_at = NOW()
      `

      // Update daily loss if negative profit
      if (profit < 0) {
        await this.sql`
          UPDATE bot_stats SET 
            daily_loss = daily_loss + ${Math.abs(profit)},
            updated_at = NOW()
        `
      }
    } catch (error) {
      console.error("Error adding profit:", error)
      throw error
    }
  }

  // Trade Methods
  async addTrade(trade: Trade) {
    await this.ensureInitialized()

    try {
      await this.sql`
        INSERT INTO trades (
          id, symbol, type, amount, price, quantity, profit, 
          timestamp, status, order_id, fees
        ) VALUES (
          ${trade.id}, ${trade.symbol}, ${trade.type}, ${trade.amount}, 
          ${trade.price}, ${trade.quantity}, ${trade.profit || null}, 
          ${trade.timestamp}, ${trade.status}, ${trade.orderId || null}, ${trade.fees || 0}
        )
      `

      // Update trades count
      await this.sql`
        UPDATE bot_stats SET 
          trades_count = trades_count + 1,
          updated_at = NOW()
      `

      await this.addLog("INFO", `Trade added: ${trade.type} ${trade.symbol}`, { trade })
    } catch (error) {
      console.error("Error adding trade:", error)
      throw error
    }
  }

  async updateTrade(updatedTrade: Trade) {
    await this.ensureInitialized()

    try {
      await this.sql`
        UPDATE trades SET 
          profit = ${updatedTrade.profit || null},
          status = ${updatedTrade.status},
          fees = ${updatedTrade.fees || 0},
          updated_at = NOW()
        WHERE id = ${updatedTrade.id}
      `

      await this.addLog("INFO", `Trade updated: ${updatedTrade.symbol}`, { trade: updatedTrade })
    } catch (error) {
      console.error("Error updating trade:", error)
      throw error
    }
  }

  async getTradeHistory(limit = 50): Promise<Trade[]> {
    await this.ensureInitialized()

    try {
      const result = await this.sql`
        SELECT * FROM trades 
        ORDER BY timestamp DESC 
        LIMIT ${limit}
      `

      return result.map((row) => ({
        id: row.id,
        symbol: row.symbol,
        type: row.type as "BUY" | "SELL",
        amount: Number(row.amount),
        price: Number(row.price),
        quantity: row.quantity,
        profit: row.profit ? Number(row.profit) : undefined,
        timestamp: row.timestamp,
        status: row.status as "OPEN" | "CLOSED",
        orderId: row.order_id || undefined,
        fees: row.fees ? Number(row.fees) : undefined,
      }))
    } catch (error) {
      console.error("Error getting trade history:", error)
      return []
    }
  }

  async getOpenTrades(symbol?: string): Promise<Trade[]> {
    await this.ensureInitialized()

    try {
      let result
      if (symbol) {
        result = await this.sql`
          SELECT * FROM trades 
          WHERE status = 'OPEN' AND symbol = ${symbol}
        `
      } else {
        result = await this.sql`
          SELECT * FROM trades 
          WHERE status = 'OPEN'
        `
      }

      return result.map((row) => ({
        id: row.id,
        symbol: row.symbol,
        type: row.type as "BUY" | "SELL",
        amount: Number(row.amount),
        price: Number(row.price),
        quantity: row.quantity,
        profit: row.profit ? Number(row.profit) : undefined,
        timestamp: row.timestamp,
        status: row.status as "OPEN" | "CLOSED",
        orderId: row.order_id || undefined,
        fees: row.fees ? Number(row.fees) : undefined,
      }))
    } catch (error) {
      console.error("Error getting open trades:", error)
      return []
    }
  }

  // Market Data Methods
  async saveMarketData(data: MarketData) {
    await this.ensureInitialized()

    try {
      await this.sql`
        INSERT INTO market_data (
          symbol, price, price_change_percent, volume, high, low, 
          open_price, bid_price, ask_price, rsi, macd_signal, sma_signal, volatility
        ) VALUES (
          ${data.symbol}, ${data.price}, ${data.priceChangePercent}, ${data.volume},
          ${data.high}, ${data.low}, ${data.openPrice}, ${data.bidPrice || null},
          ${data.askPrice || null}, ${data.rsi || null}, ${data.macdSignal || null},
          ${data.smaSignal || null}, ${data.volatility || null}
        )
      `
    } catch (error) {
      console.error("Error saving market data:", error)
      throw error
    }
  }

  async getLatestMarketData(symbol: string): Promise<MarketData | null> {
    await this.ensureInitialized()

    try {
      const result = await this.sql`
        SELECT * FROM market_data 
        WHERE symbol = ${symbol} 
        ORDER BY timestamp DESC 
        LIMIT 1
      `

      if (result.length === 0) return null

      const row = result[0]
      return {
        symbol: row.symbol,
        price: Number(row.price),
        priceChangePercent: Number(row.price_change_percent),
        volume: Number(row.volume),
        high: Number(row.high),
        low: Number(row.low),
        openPrice: Number(row.open_price),
        bidPrice: row.bid_price ? Number(row.bid_price) : undefined,
        askPrice: row.ask_price ? Number(row.ask_price) : undefined,
        rsi: row.rsi ? Number(row.rsi) : undefined,
        macdSignal: row.macd_signal || undefined,
        smaSignal: row.sma_signal || undefined,
        volatility: row.volatility ? Number(row.volatility) : undefined,
      }
    } catch (error) {
      console.error("Error getting latest market data:", error)
      return null
    }
  }

  // Price History Methods
  async savePriceHistory(data: PriceHistory) {
    await this.ensureInitialized()

    try {
      await this.sql`
        INSERT INTO price_history (
          symbol, open_price, high_price, low_price, close_price, 
          volume, open_time, close_time, interval_type
        ) VALUES (
          ${data.symbol}, ${data.openPrice}, ${data.highPrice}, ${data.lowPrice},
          ${data.closePrice}, ${data.volume}, ${data.openTime}, ${data.closeTime}, ${data.intervalType}
        )
      `
    } catch (error) {
      // Ignore duplicate key errors
      if (!error.message.includes("duplicate key")) {
        console.error("Error saving price history:", error)
      }
    }
  }

  async getPriceHistory(symbol: string, limit = 100): Promise<number[]> {
    await this.ensureInitialized()

    try {
      const result = await this.sql`
        SELECT close_price FROM price_history 
        WHERE symbol = ${symbol} 
        ORDER BY open_time DESC 
        LIMIT ${limit}
      `

      return result.map((row) => Number(row.close_price)).reverse()
    } catch (error) {
      console.error("Error getting price history:", error)
      return []
    }
  }

  // Logging Methods
  async addLog(level: "INFO" | "ERROR" | "WARNING" | "DEBUG", message: string, details?: any) {
    await this.ensureInitialized()

    try {
      // Convert details to JSON string if it's an object, otherwise keep as is
      let detailsJson = null
      if (details !== undefined && details !== null) {
        if (typeof details === "object") {
          detailsJson = JSON.stringify(details)
        } else {
          detailsJson = String(details)
        }
      }

      await this.sql`
        INSERT INTO system_logs (level, message, details)
        VALUES (${level}, ${message}, ${detailsJson})
      `

      // Keep only last 1000 logs
      await this.sql`
        DELETE FROM system_logs 
        WHERE id NOT IN (
          SELECT id FROM system_logs 
          ORDER BY timestamp DESC 
          LIMIT 1000
        )
      `
    } catch (error) {
      console.error("Error adding log:", error)
    }
  }

  async getLogs(limit = 100): Promise<
    Array<{
      timestamp: string
      level: string
      message: string
      details?: any
    }>
  > {
    await this.ensureInitialized()

    try {
      const result = await this.sql`
        SELECT timestamp, level, message, details 
        FROM system_logs 
        ORDER BY timestamp DESC 
        LIMIT ${limit}
      `

      return result.map((row) => {
        let parsedDetails = undefined

        // Handle details parsing safely
        if (row.details) {
          try {
            // If it's already an object (JSONB), use it directly
            if (typeof row.details === "object") {
              parsedDetails = row.details
            } else if (typeof row.details === "string") {
              // If it's a string, try to parse it
              parsedDetails = JSON.parse(row.details)
            }
          } catch (parseError) {
            // If parsing fails, keep the original value
            parsedDetails = row.details
          }
        }

        return {
          timestamp: row.timestamp,
          level: row.level,
          message: row.message,
          details: parsedDetails,
        }
      })
    } catch (error) {
      console.error("Error getting logs:", error)
      return []
    }
  }

  // Performance Methods
  async recordDailyPerformance() {
    await this.ensureInitialized()

try {
      const stats = await this.getStats()
      const today = new Date().toISOString().split("T")[0]

      // Try to insert, if conflict then update
      try {
        await this.sql`
          INSERT INTO daily_performance (date, profit, total_capital, trades_count, win_rate, max_drawdown)
          VALUES (${today}, ${stats.totalProfit}, ${stats.totalCapital}, ${stats.tradesCount}, ${stats.winRate}, ${stats.maxDrawdown})
        `
      } catch (insertError) {
        // If insert fails due to duplicate, update instead
        await this.sql`
          UPDATE daily_performance SET
            profit = ${stats.totalProfit},
            total_capital = ${stats.totalCapital},
            trades_count = ${stats.tradesCount},
            win_rate = ${stats.winRate},
            max_drawdown = ${stats.maxDrawdown}
          WHERE date = ${today}
        `
      }
    } catch (error) {
      console.error("Error recording daily performance:", error)
      throw error
    }
  }

  async getPerformanceData(days = 30) {
    await this.ensureInitialized()

    try {
      const result = await this.sql`
        SELECT * FROM daily_performance 
        ORDER BY date DESC 
        LIMIT ${days}
      `

      return result.map((row) => ({
        date: row.date,
        profit: Number(row.profit),
        totalCapital: Number(row.total_capital),
        tradesCount: row.trades_count,
        winRate: Number(row.win_rate),
        maxDrawdown: Number(row.max_drawdown),
      }))
    } catch (error) {
      console.error("Error getting performance data:", error)
      return []
    }
  }

  // Account Balance Methods
  async saveAccountBalance(balances: Array<{ asset: string; free: string; locked: string }>) {
    await this.ensureInitialized()

    try {
      // Clear old balances
      await this.sql`DELETE FROM account_balances`

      // Insert new balances
      for (const balance of balances) {
        if (Number(balance.free) > 0 || Number(balance.locked) > 0) {
          await this.sql`
            INSERT INTO account_balances (asset, free, locked)
            VALUES (${balance.asset}, ${balance.free}, ${balance.locked})
          `
        }
      }
    } catch (error) {
      console.error("Error saving account balance:", error)
      throw error
    }
  }

  async getAccountBalance() {
    await this.ensureInitialized()

    try {
      const result = await this.sql`
        SELECT * FROM account_balances 
        ORDER BY asset
      `

      return result.map((row) => ({
        asset: row.asset,
        free: row.free,
        locked: row.locked,
        timestamp: row.timestamp,
      }))
    } catch (error) {
      console.error("Error getting account balance:", error)
      return []
    }
  }

  // Analytics Methods
  async getTradeAnalytics() {
    await this.ensureInitialized()

    try {
      const result = await this.sql`
        SELECT 
          COUNT(*) as total_trades,
          COUNT(CASE WHEN profit > 0 THEN 1 END) as winning_trades,
          COUNT(CASE WHEN profit < 0 THEN 1 END) as losing_trades,
          AVG(profit) as avg_profit,
          MAX(profit) as max_profit,
          MIN(profit) as min_profit,
          SUM(profit) as total_profit,
          AVG(CASE WHEN profit > 0 THEN profit END) as avg_win,
          AVG(CASE WHEN profit < 0 THEN profit END) as avg_loss
        FROM trades 
        WHERE status = 'CLOSED' AND profit IS NOT NULL
      `

      if (result.length === 0) return null

      const row = result[0]
      return {
        totalTrades: Number(row.total_trades),
        winningTrades: Number(row.winning_trades),
        losingTrades: Number(row.losing_trades),
        winRate: row.total_trades > 0 ? (Number(row.winning_trades) / Number(row.total_trades)) * 100 : 0,
        avgProfit: Number(row.avg_profit) || 0,
        maxProfit: Number(row.max_profit) || 0,
        minProfit: Number(row.min_profit) || 0,
        totalProfit: Number(row.total_profit) || 0,
        avgWin: Number(row.avg_win) || 0,
        avgLoss: Number(row.avg_loss) || 0,
        profitFactor: (Number(row.avg_win) || 0) / Math.abs(Number(row.avg_loss) || 1),
      }
    } catch (error) {
      console.error("Error getting trade analytics:", error)
      return null
    }
  }

  async resetDailyLoss() {
    await this.ensureInitialized()

    try {
      await this.sql`
        UPDATE bot_stats SET 
          daily_loss = 0,
          last_reset_date = CURRENT_DATE,
          updated_at = NOW()
      `
    } catch (error) {
      console.error("Error resetting daily loss:", error)
      throw error
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.sql`SELECT 1`
      return true
    } catch (error) {
      console.error("Database health check failed:", error)
      return false
    }
  }
}