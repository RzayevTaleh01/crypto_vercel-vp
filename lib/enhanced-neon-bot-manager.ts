import { BinanceTestnetService } from "./binance-testnet-service"
import { NeonDatabaseService } from "./neon-database-service"
import { RealDataAnalyzer } from "./real-data-analyzer"
import { TelegramService } from "./telegram-service"

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

export class EnhancedNeonBotManager {
  private isRunning = false
  private binance: BinanceTestnetService
  private database: NeonDatabaseService
  private analyzer: RealDataAnalyzer
  private telegram: TelegramService
  private tradingInterval: NodeJS.Timeout | null = null
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor() {
    this.binance = new BinanceTestnetService()
    this.database = new NeonDatabaseService()
    this.analyzer = new RealDataAnalyzer()
    this.telegram = new TelegramService()
  }

  async start(config: BotConfig) {
    if (this.isRunning) {
      throw new Error("Bot is already running")
    }

    // Test connections
    const binanceConnected = await this.binance.testConnection()
    const dbHealthy = await this.database.healthCheck()

    if (!binanceConnected) {
      throw new Error("Failed to connect to Binance testnet")
    }

    if (!dbHealthy) {
      throw new Error("Database connection failed")
    }

    this.isRunning = true

    // Save configuration
    await this.database.updateConfig(config)
    await this.database.updateBotStatus(true)
    await this.database.addLog("INFO", "Enhanced Neon bot started", { config })

    // Start real data analysis
    await this.analyzer.startAnalysis(config.tradingPairs)

    // Get and save account info
    try {
      const accountInfo = await this.binance.getAccountInfo()
      await this.database.saveAccountBalance(accountInfo.balances)

      const usdtBalance = accountInfo.balances.find((b) => b.asset === "USDT")
      await this.database.addLog("INFO", `Account connected - USDT Balance: ${usdtBalance?.free || "0"}`)

      if (config.telegramEnabled) {
        await this.telegram.sendMessage(
          `🤖 Enhanced Neon Trading Bot Started!\n\n` +
            `💰 Initial Capital: $${config.initialCapital}\n` +
            `💳 USDT Balance: ${usdtBalance?.free || "0"} USDT\n` +
            `📊 Trade Size: ${config.tradePercentage}%\n` +
            `📉 Buy Threshold: ${config.buyThreshold}%\n` +
            `📈 Sell Threshold: ${config.sellThreshold}%\n` +
            `🛡️ Max Daily Loss: ${config.riskManagement.maxDailyLoss}%\n` +
            `📈 Trading Pairs: ${config.tradingPairs.join(", ")}\n` +
            `🗄️ Database: Neon PostgreSQL\n` +
            `🔍 Real-time Analysis: Active`,
        )
      }
    } catch (error) {
      await this.database.addLog("ERROR", "Failed to get account info", { error: error.message })
    }

    // Start trading loop
    this.startTradingLoop()

    // Start monitoring loop
    this.startMonitoringLoop()

    return {
      success: true,
      message: "Enhanced Neon bot started successfully",
      features: ["Real Binance API", "Neon Database", "Technical Analysis", "Risk Management"],
    }
  }

  async stop() {
    if (!this.isRunning) {
      throw new Error("Bot is not running")
    }

    this.isRunning = false

    // Stop all intervals
    if (this.tradingInterval) {
      clearInterval(this.tradingInterval)
      this.tradingInterval = null
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    // Stop analysis
    await this.analyzer.stopAnalysis()

    // Update database
    await this.database.updateBotStatus(false)
    await this.database.addLog("INFO", "Enhanced Neon bot stopped")

    // Send final report
    const config = await this.database.getConfig()
    if (config?.telegramEnabled) {
      const stats = await this.database.getStats()
      const analytics = await this.database.getTradeAnalytics()

      let message = `🛑 Enhanced Neon Bot Stopped\n\n`
      message += `💰 Final Capital: $${stats.totalCapital.toFixed(2)}\n`
      message += `📈 Total Profit: $${stats.totalProfit.toFixed(2)}\n`
      message += `🔢 Total Trades: ${stats.tradesCount}\n`

      if (analytics) {
        message += `📊 Win Rate: ${analytics.winRate.toFixed(1)}%\n`
        message += `💪 Profit Factor: ${analytics.profitFactor.toFixed(2)}\n`
        message += `📉 Max Drawdown: ${stats.maxDrawdown.toFixed(2)}%\n`
      }

      await this.telegram.sendMessage(message)
    }

    return { success: true, message: "Enhanced Neon bot stopped successfully" }
  }

  private startTradingLoop() {
    // Execute trading logic every 30 seconds
    this.tradingInterval = setInterval(async () => {
      if (!this.isRunning) return

      try {
        await this.executeTradingLogic()
      } catch (error) {
        console.error("Trading loop error:", error)
        await this.database.addLog("ERROR", "Trading loop error", { error: error.message })
      }
    }, 30000)
  }

  private startMonitoringLoop() {
    // Monitor system health every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      if (!this.isRunning) return

      try {
        await this.performHealthChecks()
        await this.database.recordDailyPerformance()
        await this.checkDailyLossReset()
      } catch (error) {
        console.error("Monitoring loop error:", error)
        await this.database.addLog("ERROR", "Monitoring loop error", { error: error.message })
      }
    }, 300000) // 5 minutes
  }

  private async executeTradingLogic() {
    const config = await this.database.getConfig()
    if (!config) return

    const stats = await this.database.getStats()

    // Check daily loss limit
    if (stats.dailyLoss >= config.riskManagement.maxDailyLoss) {
      await this.database.addLog("WARNING", "Daily loss limit reached, stopping trades for today")
      return
    }

    // Get analysis results
    const analysisResults = await this.analyzer.getAnalysisResults()

    for (const analysis of analysisResults) {
      try {
        // Check for buy opportunities
        if (analysis.signal === "BUY" && analysis.confidence > 70) {
          const openTrades = await this.database.getOpenTrades()

          if (openTrades.length < config.riskManagement.maxOpenTrades) {
            const tradeAmount = (stats.totalCapital * config.tradePercentage) / 100

            if (tradeAmount >= 10) {
              // Minimum $10 trade
              await this.executeBuy(analysis.symbol, analysis.marketData.price, tradeAmount)
            }
          }
        }

        // Check open positions for sell opportunities
        const openTrades = await this.database.getOpenTrades(analysis.symbol)
        for (const trade of openTrades) {
          if (await this.shouldSell(trade, analysis, config)) {
            await this.executeSell(trade, analysis.marketData.price)
          }
        }
      } catch (error) {
        console.error(`Error processing ${analysis.symbol}:`, error)
        await this.database.addLog("ERROR", `Error processing ${analysis.symbol}`, { error: error.message })
      }
    }
  }

  private async shouldSell(trade: any, analysis: any, config: BotConfig): Promise<boolean> {
    const currentPrice = analysis.marketData.price
    const profitPercent = ((currentPrice - trade.price) / trade.price) * 100

    // Stop loss check
    if (profitPercent <= -config.riskManagement.stopLossPercentage) {
      await this.database.addLog("WARNING", `Stop loss triggered for ${trade.symbol}`, {
        profitPercent,
        stopLoss: config.riskManagement.stopLossPercentage,
      })
      return true
    }

    // Profit target check
    if (profitPercent >= config.sellThreshold) {
      await this.database.addLog("INFO", `Profit target reached for ${trade.symbol}`, {
        profitPercent,
        target: config.sellThreshold,
      })
      return true
    }

    // Technical analysis exit signals
    if (analysis.signal === "SELL" && analysis.confidence > 60 && profitPercent > 0) {
      await this.database.addLog("INFO", `Technical analysis suggests exit for ${trade.symbol}`, {
        signal: analysis.signal,
        confidence: analysis.confidence,
      })
      return true
    }

    return false
  }

  private async executeBuy(symbol: string, price: number, tradeAmount: number) {
    try {
      // Calculate quantity
      const quantity = await this.binance.calculateQuantity(symbol, tradeAmount)

      // Place real order
      const order = await this.binance.placeOrder(symbol, "BUY", "MARKET", quantity)

      const trade = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        type: "BUY" as const,
        amount: tradeAmount,
        price,
        quantity,
        timestamp: new Date().toISOString(),
        status: "OPEN" as const,
        orderId: order.orderId,
        fees: Number(order.fills?.[0]?.commission || "0"),
      }

      await this.database.addTrade(trade)
      await this.database.updateCapital(-tradeAmount)

      await this.database.addLog("INFO", `BUY ORDER EXECUTED: ${symbol}`, {
        orderId: order.orderId,
        quantity,
        price,
        amount: tradeAmount,
        fees: trade.fees,
      })

      const config = await this.database.getConfig()
      if (config?.telegramEnabled) {
        await this.telegram.sendMessage(
          `🟢 REAL BUY EXECUTED\n\n` +
            `💱 ${symbol}\n` +
            `💰 Amount: $${tradeAmount.toFixed(2)}\n` +
            `📊 Quantity: ${quantity}\n` +
            `💲 Price: $${price.toFixed(4)}\n` +
            `🆔 Order ID: ${order.orderId}\n` +
            `💸 Fees: ${order.fills?.[0]?.commission || "0"} ${order.fills?.[0]?.commissionAsset || ""}\n` +
            `🗄️ Saved to Neon DB`,
        )
      }
    } catch (error) {
      await this.database.addLog("ERROR", `Failed to execute buy for ${symbol}`, { error: error.message })
      throw error
    }
  }

  private async executeSell(trade: any, currentPrice: number) {
    try {
      // Place real sell order
      const order = await this.binance.placeOrder(trade.symbol, "SELL", "MARKET", trade.quantity)

      const profitAmount = (currentPrice - trade.price) * Number(trade.quantity)
      const totalReturn = trade.amount + profitAmount

      const updatedTrade = {
        ...trade,
        profit: profitAmount,
        status: "CLOSED" as const,
        fees: (trade.fees || 0) + Number(order.fills?.[0]?.commission || "0"),
      }

      await this.database.updateTrade(updatedTrade)
      await this.database.updateCapital(totalReturn)
      await this.database.addProfit(profitAmount)

      await this.database.addLog("INFO", `SELL ORDER EXECUTED: ${trade.symbol}`, {
        orderId: order.orderId,
        profit: profitAmount,
        profitPercent: (profitAmount / trade.amount) * 100,
        totalFees: updatedTrade.fees,
      })

      const config = await this.database.getConfig()
      if (config?.telegramEnabled) {
        const profitPercent = (profitAmount / trade.amount) * 100
        await this.telegram.sendMessage(
          `🔴 REAL SELL EXECUTED\n\n` +
            `💱 ${trade.symbol}\n` +
            `💰 Amount: $${trade.amount.toFixed(2)}\n` +
            `📊 Quantity: ${trade.quantity}\n` +
            `💲 Sell Price: $${currentPrice.toFixed(4)}\n` +
            `💵 Profit: $${profitAmount.toFixed(2)} (${profitPercent.toFixed(2)}%)\n` +
            `🆔 Order ID: ${order.orderId}\n` +
            `💸 Total Fees: ${updatedTrade.fees?.toFixed(6) || "0"}\n` +
            `${profitAmount > 0 ? "✅ Profitable Trade" : "❌ Loss"}\n` +
            `🗄️ Updated in Neon DB`,
        )
      }
    } catch (error) {
      await this.database.addLog("ERROR", `Failed to execute sell for ${trade.symbol}`, { error: error.message })
      throw error
    }
  }

  private async performHealthChecks() {
    const checks = {
      binance: await this.binance.testConnection(),
      database: await this.database.healthCheck(),
      analyzer: this.analyzer.isAnalysisRunning(),
    }

    await this.database.addLog("INFO", "Health check completed", checks)

    if (!checks.binance || !checks.database) {
      const config = await this.database.getConfig()
      if (config?.telegramEnabled) {
        await this.telegram.sendMessage(
          `⚠️ Health Check Alert\n\n` +
            `🌐 Binance: ${checks.binance ? "✅" : "❌"}\n` +
            `🗄️ Database: ${checks.database ? "✅" : "❌"}\n` +
            `🔍 Analyzer: ${checks.analyzer ? "✅" : "❌"}`,
        )
      }
    }
  }

  private async checkDailyLossReset() {
    const stats = await this.database.getStats()
    const today = new Date().toDateString()
    const lastReset = new Date(stats.dailyLoss).toDateString()

    if (today !== lastReset) {
      await this.database.resetDailyLoss()
      await this.database.addLog("INFO", "Daily loss counter reset")
    }
  }

  // Public methods for API access
  async getStats() {
    return await this.database.getStats()
  }

  async getTradeHistory() {
    return await this.database.getTradeHistory()
  }

  async getPortfolio() {
    return await this.database.getOpenTrades()
  }

  async getSuggestions() {
    try {
      const analysisResults = await this.analyzer.getAnalysisResults()
      return analysisResults
        .filter((r) => r.confidence > 60)
        .slice(0, 5)
        .map((r) => ({
          symbol: r.symbol,
          reason: r.reasons.join(", "),
          change: r.marketData.change,
          confidence: r.confidence,
          signal: r.signal,
          price: r.marketData.price,
        }))
    } catch (error) {
      console.error("Error getting suggestions:", error)
      return []
    }
  }

  async getLogs() {
    return await this.database.getLogs()
  }

  async getPerformanceData() {
    return await this.database.getPerformanceData()
  }

  async getAnalytics() {
    return await this.database.getTradeAnalytics()
  }

  async getMarketSummary() {
    return await this.analyzer.getMarketSummary()
  }

  async getAccountBalance() {
    return await this.database.getAccountBalance()
  }

  isRunning(): boolean {
    return this.isRunning
  }
}

// Singleton instance
const enhancedNeonBotManager = new EnhancedNeonBotManager()

export const startNeonBot = (config: any) => enhancedNeonBotManager.start(config)
export const stopNeonBot = () => enhancedNeonBotManager.stop()
export const getNeonBotStats = () => enhancedNeonBotManager.getStats()
export const getNeonTradeHistory = () => enhancedNeonBotManager.getTradeHistory()
export const getNeonPortfolio = () => enhancedNeonBotManager.getPortfolio()
export const getNeonSuggestions = () => enhancedNeonBotManager.getSuggestions()
export const getNeonLogs = () => enhancedNeonBotManager.getLogs()
export const getNeonPerformanceData = () => enhancedNeonBotManager.getPerformanceData()
export const getNeonAnalytics = () => enhancedNeonBotManager.getAnalytics()
export const getNeonMarketSummary = () => enhancedNeonBotManager.getMarketSummary()
export const getNeonAccountBalance = () => enhancedNeonBotManager.getAccountBalance()
export const isNeonBotRunning = () => enhancedNeonBotManager.isRunning()
