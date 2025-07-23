import { BinanceTestnetService } from "./binance-testnet-service"
import { NeonDatabaseService } from "./neon-database-service"
import { TelegramService } from "./telegram-service"
import { MarketAnalyzer } from "./market-analyzer"

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
  technicalIndicators: {
    useRSI: boolean
    useMACD: boolean
    useSMA: boolean
  }
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

export class TradingBot {
  private isRunning = false
  private config: BotConfig | null = null
  private binance: BinanceTestnetService
  private database: NeonDatabaseService
  private telegram: TelegramService
  private analyzer: MarketAnalyzer
  private tradingInterval: NodeJS.Timeout | null = null

  constructor() {
    // Check environment variables before creating services
    if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
      console.warn("⚠️ Binance API credentials not set. Bot will not be able to trade.")
    }
    
    try {
      this.binance = new BinanceTestnetService()
    } catch (error) {
      console.warn("⚠️ Binance service initialization failed:", error.message)
      this.binance = null as any
    }
    
    this.database = new NeonDatabaseService()
    this.telegram = new TelegramService()
    this.analyzer = new MarketAnalyzer()
  }

  private async forceStop() {
    console.log("🛑 Force stop initiated...")
    
    // Immediately set running to false
    this.isRunning = false

    // Clear trading interval
    if (this.tradingInterval) {
      clearInterval(this.tradingInterval)
      this.tradingInterval = null
      console.log("✅ Trading interval cleared")
    }

    // Stop market analyzer
    try {
      await this.analyzer.stopAnalysis()
      console.log("✅ Market analyzer stopped")
    } catch (error) {
      console.warn("⚠️ Analyzer stop failed:", error)
    }

    // Update database status
    try {
      await this.database.updateBotStatus(false)
      await this.database.addLog("INFO", "Bot məcburi dayandırıldı (force stop)")
      console.log("✅ Database status updated")
    } catch (error) {
      console.warn("⚠️ Database update failed during force stop:", error)
    }
  }

  async start(config: BotConfig) {
    // Check if already running
    const dbStats = await this.database.getStats()
    if (this.isRunning || dbStats.isRunning) {
      await this.forceStop()
    }

    try {
      await this.database.addLog("INFO", "Bot başlama prosesi başladı", { config })

      // Test Binance connection first - REQUIRED
      console.log("🔍 Testing Binance testnet connection...")
      let binanceConnected = false
      try {
        binanceConnected = await this.binance.testConnection()
        console.log(`Binance testnet connection status: ${binanceConnected ? "SUCCESS" : "FAILED"}`)
      } catch (connError: any) {
        console.error(`Binance testnet connection test failed with error: ${connError.message}`)
        await this.database.addLog("ERROR", "Binance testnet bağlantı testi xətası", {
          error: connError.message,
          errorName: connError.name,
        })
        throw new Error(
          `Binance testnet bağlantısı uğursuz. API key-ləri yoxlayın və testnet aktiv olduğundan əmin olun. Xəta: ${connError.message}`,
        )
      }

      if (!binanceConnected) {
        // This block will only be reached if testConnection returns false without throwing an error.
        // Given the current error, it's more likely to throw, but keeping this for robustness.
        await this.database.addLog("ERROR", "Binance testnet bağlantısı uğursuz (testConnection false qaytardı).")
        throw new Error(
          "Binance testnet bağlantısı uğursuz. API key-ləri yoxlayın və testnet aktiv olduğundan əmin olun.",
        )
      }

      await this.database.addLog("INFO", "Binance testnet bağlantısı uğurlu")

      // Get account info - REQUIRED
      console.log("📊 Getting account information...")
      let accountInfo
      let usdtBalance
      try {
        accountInfo = await this.binance.getAccountInfo()
        usdtBalance = accountInfo.balances.find((b) => b.asset === "USDT")
      } catch (accountError: any) {
        console.error(`Failed to get account info: ${accountError.message}`)
        await this.database.addLog("ERROR", "Hesab məlumatları alınarkən xəta", {
          error: accountError.message,
          errorName: accountError.name,
        })
        throw new Error(
          `Hesab məlumatları alınarkən xəta baş verdi. API key-lərinizin düzgün olduğundan və testnet hesabınızda aktiv olduğundan əmin olun. Xəta: ${accountError.message}`,
        )
      }

      if (!usdtBalance || Number(usdtBalance.free) < 10) {
        throw new Error(
          `Kifayət qədər USDT balansı yoxdur. Cari balans: ${usdtBalance?.free || "0"} USDT. Minimum 10 USDT lazımdır.`,
        )
      }

      this.config = config
      this.isRunning = true

      // Save configuration
      await this.database.updateConfig({
        ...config,
        riskManagement: config.riskManagement,
        tradingPairs: [], // Will be dynamically selected
        technicalIndicators: config.technicalIndicators,
      })

      await this.database.updateBotStatus(true)
      await this.database.addLog("INFO", "Bot konfiqurasiyası saxlanıldı")

      // Start dynamic market analysis for all testnet coins
      console.log("📈 Starting comprehensive testnet coin analysis...")
      await this.database.addLog("INFO", "Bütün testnet coinlərinin analizi başladılır...")
      await this.analyzer.startAnalysis()
      await this.database.addLog("INFO", "Testnet coin analizi aktiv", {
        note: "Binance Testnet-dəki bütün USDT pairs analiz edilir və ən perspektivləri seçilir",
        selectionCriteria: "Həcm, volatility, texniki göstəricilər və likvidlik əsasında",
        updateInterval: "5 dəqiqə",
        analysisInterval: "30 saniyə",
        maxPairs: "8 ədəd ən yaxşı"
      })

      // Start trading loop
      this.startTradingLoop()
      await this.database.addLog("INFO", "Trading loop başladı", { interval: "45 saniyə" })

      // Send Telegram notification
      if (config.telegramEnabled) {
        await this.telegram.sendAlert(
          "🤖 Dynamic Trading Bot Başladı!",
          `✅ Real Binance Testnet Mode\n\n` +
            `💰 Başlanğıc Kapital: $${config.initialCapital}\n` +
            `💳 USDT Balans: ${usdtBalance.free} USDT\n` +
            `📊 Trade Ölçüsü: ${config.tradePercentage}%\n` +
            `🎯 Alış Hədd: ${config.buyThreshold}%\n` +
            `🎯 Satış Hədd: ${config.sellThreshold}%\n` +
            `🔍 Market Analizi: Dynamic - Bütün coinlər\n` +
            `🏆 Pair Selection: Avtomatik ən yaxşıları seçir\n` +
            `⚡ Technical Analysis: RSI, MACD, SMA, Volume\n` +
            `🔄 Update Interval: 5 dəqiqə`,
          "success",
        )
      }

      await this.database.addLog("INFO", "Bot uğurla başladı", {
        mode: "dynamic-real-testnet",
        analysisActive: true,
        tradingActive: true,
        pairSelection: "automatic",
        usdtBalance: usdtBalance.free,
      })

      return {
        success: true,
        message: "Dynamic Trading bot uğurla başladı",
        mode: "dynamic-real-testnet",
        binanceStatus: "connected",
        databaseStatus: "connected",
        analysisStatus: "dynamic-active",
        pairSelection: "automatic",
        usdtBalance: usdtBalance.free,
      }
    } catch (error: any) {
      this.isRunning = false
      await this.database.addLog("ERROR", "Bot başlama xətası", { error: error.message, errorName: error.name })
      throw error
    }
  }

  async stop() {
    try {
      // Check current status from database
      let dbStats
      try {
        dbStats = await this.database.getStats()
      } catch (dbError) {
        console.warn("Database stats check failed during stop:", dbError)
        dbStats = { isRunning: false }
      }

      // If already stopped according to both memory and database
      if (!this.isRunning && !dbStats.isRunning) {
        await this.database.addLog("INFO", "Bot artıq dayandırılmış vəziyyətdə")
        return {
          success: true,
          message: "Bot artıq dayandırılıb",
          wasRunning: false,
        }
      }

      await this.database.addLog("INFO", "Bot dayandırma prosesi başladı")
      console.log("🛑 Starting bot stop process...")

      // Force stop to ensure clean shutdown
      await this.forceStop()

      // Send final report if telegram is enabled
      try {
        const config = await this.database.getConfig()
        if (config?.telegramEnabled) {
          const finalStats = await this.database.getStats()
          let pairStats
          try {
            pairStats = await this.analyzer.getCurrentPairStats()
          } catch {
            pairStats = { pairCount: 0, lastUpdate: "Bilinmir" }
          }

          await this.telegram.sendAlert(
            "🛑 Dynamic Trading Bot Dayandırıldı",
            `💰 Son Kapital: $${finalStats.totalCapital.toFixed(2)}\n` +
              `📈 Ümumi Mənfəət: $${finalStats.totalProfit.toFixed(2)}\n` +
              `🔢 Ümumi Trade-lər: ${finalStats.tradesCount}\n` +
              `📊 Uğur Nisbəti: ${finalStats.winRate.toFixed(1)}%\n` +
              `🏆 Son Seçilmiş Pairs: ${pairStats.pairCount} ədəd\n` +
              `⏰ Son Yeniləmə: ${pairStats.lastUpdate}`,
            "warning",
          )
        }
      } catch (reportError) {
        console.warn("Final report sending failed:", reportError)
        await this.database.addLog("WARNING", "Son hesabat göndərilə bilmədi", {
          error: reportError.message
        })
      }

      await this.database.addLog("INFO", "Dynamic trading bot uğurla dayandırıldı")
      console.log("✅ Bot stop process completed")

      return {
        success: true,
        message: "Dynamic bot uğurla dayandırıldı",
        wasRunning: true,
      }

    } catch (error) {
      console.error("Stop method error:", error)
      await this.database.addLog("ERROR", "Bot dayandırma xətası", {
        error: error.message
      })
      
      // Force stop as fallback
      try {
        await this.forceStop()
      } catch (forceError) {
        console.error("Force stop also failed:", forceError)
      }

      throw error
    }
  }

  private startTradingLoop() {
    // Slightly longer interval to allow for thorough analysis
    this.tradingInterval = setInterval(async () => {
      if (!this.isRunning || !this.config) return

      try {
        await this.executeTradingLogic()
      } catch (error) {
        await this.database.addLog("ERROR", "Trading loop xətası", { error: error.message })
      }
    }, 45000) // 45 seconds
  }

  private async executeTradingLogic() {
    if (!this.config) return

    try {
      await this.database.addLog("DEBUG", "Ətraflı trading logic dövrü başladı")

      const stats = await this.database.getStats()
      const analysisResults = await this.analyzer.getLatestAnalysis()

      if (analysisResults.length === 0) {
        await this.database.addLog("WARNING", "Analiz nəticəsi yoxdur, analyzer yenidən işləyir...")
        // Try to restart analyzer if it's not working
        if (!this.analyzer.isRunning()) {
          await this.analyzer.startAnalysis()
        }
        return
      }

      // Enhanced filtering for testnet coins
      const filteredResults = analysisResults.filter(analysis => {
        // Daha aşağı həcm tələbi testnet üçün (500K USDT)
        const volumeOk = analysis.marketData.volume >= 500000
        // Testnet üçün daha çox volatilityə icazə (20%)
        const volatilityOk = Math.abs(analysis.marketData.priceChangePercent) < 20
        // Valid price data və minimum qiymət
        const priceOk = analysis.marketData.price > 0 && analysis.marketData.price < 100000
        // Yaxşı technical göstəricilər
        const technicalOk = analysis.confidence > 0 || analysis.technicalIndicators.rsi > 0
        
        return volumeOk && volatilityOk && priceOk && technicalOk
      })

      // Sort by confidence and volume
      const sortedResults = filteredResults.sort((a, b) => {
        const scoreA = a.confidence + (a.marketData.volume / 10000000) // Volume bonus
        const scoreB = b.confidence + (b.marketData.volume / 10000000)
        return scoreB - scoreA
      })

      await this.database.addLog("INFO", "Təkmilləşdirilmiş market analiz nəticələri", {
        totalAnalyzed: analysisResults.length,
        filtered: filteredResults.length,
        activePairs: sortedResults.slice(0, 5).map((r) => r.symbol),
        topOpportunity: sortedResults[0]
          ? {
              symbol: sortedResults[0].symbol,
              signal: sortedResults[0].signals.overall,
              confidence: sortedResults[0].confidence,
              volume: `${(sortedResults[0].marketData.volume / 1000000).toFixed(1)}M`,
            }
          : null,
      })

      // Process only top opportunities to avoid overtrading
      const topOpportunities = sortedResults.slice(0, Math.min(5, sortedResults.length))

      for (const analysis of topOpportunities) {
        try {
          const symbol = analysis.symbol
          const currentPrice = analysis.marketData.price
          const priceChange = analysis.marketData.priceChangePercent

          // Advanced technical analysis validation
          const rsi = analysis.technicalIndicators.rsi
          const volume24h = analysis.marketData.volume / 1000000

          await this.database.addLog("DEBUG", `${symbol} ətraflı analiz`, {
            price: currentPrice,
            change: priceChange,
            volume: `${volume24h.toFixed(1)}M`,
            rsi: rsi.toFixed(1),
            signal: analysis.signals.overall,
            confidence: analysis.confidence,
            reasons: analysis.reasons.slice(0, 2),
          })

          // IMPROVED BUY LOGIC
          if (this.shouldBuy(analysis, stats)) {
            const openTrades = await this.database.getOpenTrades()
            const symbolTrades = await this.database.getOpenTrades(symbol)

            // Risk management: max 3 total trades, max 1 per symbol
            if (openTrades.length < 3 && symbolTrades.length === 0) {
              const tradeAmount = (stats.totalCapital * this.config.tradePercentage) / 100

              if (tradeAmount >= 10) {
                await this.database.addLog("INFO", `${symbol} ALIŞA HAZIR - ətraflı analiz`, {
                  confidence: analysis.confidence,
                  reasons: analysis.reasons.slice(0, 3),
                  tradeAmount: tradeAmount.toFixed(2),
                  volume: `${volume24h.toFixed(1)}M USDT`,
                  rsi: rsi.toFixed(1),
                  priceChange: priceChange.toFixed(2),
                  signals: {
                    rsi: analysis.signals.rsi,
                    macd: analysis.signals.macd,
                    sma: analysis.signals.sma,
                  },
                })

                await this.executeBuy(symbol, currentPrice, tradeAmount, analysis)
              }
            }
          }

          // IMPROVED SELL LOGIC
          const openTrades = await this.database.getOpenTrades(symbol)
          for (const trade of openTrades) {
            const sellDecision = this.shouldSell(trade, analysis, currentPrice)

            if (sellDecision.shouldSell) {
              await this.database.addLog("INFO", `${symbol} SATIŞA HAZIR - qərar analizi`, {
                reason: sellDecision.reason,
                profitPercent: sellDecision.profitPercent,
                confidence: analysis.confidence,
                rsi: rsi.toFixed(1),
                tradeDuration: this.getTradeDuration(trade),
              })

              await this.executeSell(trade, currentPrice, analysis, sellDecision.reason)
            }
          }
        } catch (symbolError: any) {
          await this.database.addLog("ERROR", `${analysis.symbol} trading xətası`, {
            error: symbolError.message,
            stage: "symbol_processing",
          })
        }
      }

      // Enhanced status logging
      const pairStats = await this.analyzer.getCurrentPairStats()
      const openTrades = await this.database.getOpenTrades()
      
      await this.database.addLog("INFO", "Trading dövrü tamamlandı - status", {
        processedPairs: topOpportunities.length,
        openTrades: openTrades.length,
        currentCapital: stats.totalCapital.toFixed(2),
        totalProfit: stats.totalProfit.toFixed(2),
        currentPairs: pairStats.currentPairs?.slice(0, 3) || [],
        nextPairUpdate: pairStats.nextUpdate,
      })
    } catch (error: any) {
      await this.database.addLog("ERROR", "Trading logic kritik xəta", { 
        error: error.message,
        stack: error.stack?.slice(0, 500),
      })
    }
  }

  private shouldBuy(analysis: any, stats: any): boolean {
    const { signals, confidence, technicalIndicators, marketData } = analysis
    
    // Multi-criteria buy decision
    const conditions = {
      strongSignal: signals.overall === "BUY" && confidence >= 75,
      mediumSignal: signals.overall === "BUY" && confidence >= 60 && technicalIndicators.rsi < 35,
      volumeGood: marketData.volume >= 1000000, // 1M USDT minimum
      rsiOversold: technicalIndicators.rsi < 40,
      positiveSignals: [signals.rsi, signals.macd, signals.sma].filter(s => s === "BUY").length >= 2,
      capitalAvailable: stats.totalCapital > 50, // Minimum capital
      priceStable: Math.abs(marketData.priceChangePercent) < 10, // Not too volatile
    }

    const buyScore = Object.values(conditions).filter(Boolean).length
    const shouldBuy = buyScore >= 5 && (conditions.strongSignal || conditions.mediumSignal)

    return shouldBuy
  }

  private shouldSell(trade: any, analysis: any, currentPrice: number): {shouldSell: boolean, reason: string, profitPercent: number} {
    const profitPercent = ((currentPrice - trade.price) / trade.price) * 100
    const { signals, confidence, technicalIndicators } = analysis
    const tradeDuration = Date.now() - new Date(trade.timestamp).getTime()
    const hoursOpen = tradeDuration / (1000 * 60 * 60)

    // Stop loss - immediate
    if (profitPercent <= -5) {
      return {
        shouldSell: true,
        reason: `Zərər məhdudiyyəti (${profitPercent.toFixed(2)}%)`,
        profitPercent
      }
    }

    // Profit targets - tiered
    if (profitPercent >= this.config!.sellThreshold) {
      return {
        shouldSell: true,
        reason: `Mənfəət həddi çatdı (${profitPercent.toFixed(2)}%)`,
        profitPercent
      }
    }

    // Medium profit with strong sell signal
    if (profitPercent >= 2 && signals.overall === "SELL" && confidence > 70) {
      return {
        shouldSell: true,
        reason: `Orta mənfəət + güclü satış siqnalı (${profitPercent.toFixed(2)}%, ${confidence}% confidence)`,
        profitPercent
      }
    }

    // Small profit but very strong negative signals
    if (profitPercent >= 0.5 && signals.overall === "SELL" && confidence > 85) {
      return {
        shouldSell: true,
        reason: `Çox güclü neqativ siqnal - erkən çıxış (${confidence}% confidence)`,
        profitPercent
      }
    }

    // RSI overbought exit with profit
    if (profitPercent > 1 && technicalIndicators.rsi > 80) {
      return {
        shouldSell: true,
        reason: `RSI həddindən artıq (${technicalIndicators.rsi.toFixed(1)}) + mənfəət`,
        profitPercent
      }
    }

    // Time-based exit for stagnant trades
    if (hoursOpen > 24 && profitPercent > -2 && profitPercent < 1) {
      return {
        shouldSell: true,
        reason: `24 saat durğun trade - çıxış (${profitPercent.toFixed(2)}%)`,
        profitPercent
      }
    }

    return { shouldSell: false, reason: "", profitPercent }
  }

  private getTradeDuration(trade: any): string {
    const duration = Date.now() - new Date(trade.timestamp).getTime()
    const hours = Math.floor(duration / (1000 * 60 * 60))
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}s ${minutes}d`
  }

  private async executeBuy(symbol: string, price: number, tradeAmount: number, analysis: any) {
    try {
      await this.database.addLog("INFO", `${symbol} alış əməliyyatı başladı`, {
        price,
        amount: tradeAmount,
        volume: `${(analysis.marketData.volume / 1000000).toFixed(1)}M`,
        analysis: {
          rsi: analysis.technicalIndicators.rsi,
          confidence: analysis.confidence,
          reasons: analysis.reasons.slice(0, 3),
        },
      })

      const quantity = await this.binance.calculateQuantity(symbol, tradeAmount)
      const order = await this.binance.placeOrder(symbol, "BUY", "MARKET", quantity)

      const trade: Trade = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        type: "BUY",
        amount: tradeAmount,
        price,
        quantity,
        timestamp: new Date().toISOString(),
        status: "OPEN",
        orderId: order.orderId,
        fees: Number(order.fills?.[0]?.commission || "0"),
      }

      await this.database.addTrade(trade)
      await this.database.updateCapital(-tradeAmount)

      await this.database.addLog("INFO", `${symbol} alış əməliyyatı tamamlandı`, {
        orderId: order.orderId,
        quantity,
        fees: trade.fees,
        executedPrice: order.fills?.[0]?.price,
        confidence: analysis.confidence,
      })

      if (this.config?.telegramEnabled) {
        await this.telegram.sendAlert(
          "🟢 DYNAMIC ALIŞ İCRA EDİLDİ",
          `💱 ${symbol} (Avtomatik seçildi)\n` +
            `💰 Məbləğ: $${tradeAmount.toFixed(2)}\n` +
            `💲 Qiymət: $${price.toFixed(4)}\n` +
            `📊 Quantity: ${quantity}\n` +
            `🆔 Order ID: ${order.orderId}\n` +
            `📈 RSI: ${analysis.technicalIndicators.rsi.toFixed(1)}\n` +
            `🎯 Confidence: ${analysis.confidence}%\n` +
            `📊 24h Volume: ${(analysis.marketData.volume / 1000000).toFixed(1)}M USDT\n` +
            `💸 Fees: ${trade.fees} ${order.fills?.[0]?.commissionAsset || ""}\n` +
            `🔍 Top Reasons:\n${analysis.reasons
              .slice(0, 2)
              .map((r: string) => `• ${r}`)
              .join("\n")}`,
          "success",
        )
      }
    } catch (error: any) {
      // Explicitly type error as any
      await this.database.addLog("ERROR", `${symbol} alış xətası`, { error: error.message })
      throw error
    }
  }

  private async executeSell(trade: Trade, currentPrice: number, analysis: any, reason: string) {
    try {
      await this.database.addLog("INFO", `${trade.symbol} satış əməliyyatı başladı`, {
        reason,
        currentPrice,
        buyPrice: trade.price,
        analysis: {
          rsi: analysis.technicalIndicators.rsi,
          confidence: analysis.confidence,
        },
      })

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

      await this.database.addLog("INFO", `${trade.symbol} satış əməliyyatı tamamlandı`, {
        orderId: order.orderId,
        profit: profitAmount,
        profitPercent: (profitAmount / trade.amount) * 100,
        totalFees: updatedTrade.fees,
        reason,
        confidence: analysis.confidence,
      })

      if (this.config?.telegramEnabled) {
        const profitPercent = (profitAmount / trade.amount) * 100
        await this.telegram.sendAlert(
          "🔴 DYNAMIC SATIŞ İCRA EDİLDİ",
          `💱 ${trade.symbol}\n` +
            `💰 Məbləğ: $${trade.amount.toFixed(2)}\n` +
            `💲 Satış Qiyməti: $${currentPrice.toFixed(4)}\n` +
            `💵 Profit: $${profitAmount.toFixed(2)} (${profitPercent.toFixed(2)}%)\n` +
            `🆔 Order ID: ${order.orderId}\n` +
            `📈 RSI: ${analysis.technicalIndicators.rsi.toFixed(1)}\n` +
            `🎯 Confidence: ${analysis.confidence}%\n` +
            `📝 Səbəb: ${reason}\n` +
            `💸 Total Fees: ${updatedTrade.fees?.toFixed(6) || "0"}\n` +
            `${profitAmount > 0 ? "✅ Mənfəətli Trade" : "❌ Zərərli Trade"}`,
          profitAmount > 0 ? "success" : "error",
        )
      }
    } catch (error: any) {
      // Explicitly type error as any
      await this.database.addLog("ERROR", `${trade.symbol} satış xətası`, { error: error.message })
      throw error
    }
  }

  // Public methods
  async getStats() {
    return await this.database.getStats()
  }

  async getTradeHistory() {
    return await this.database.getTradeHistory()
  }

  async getOpenTrades() {
    return await this.database.getOpenTrades()
  }

  async getLogs() {
    return await this.database.getLogs()
  }

  async isRunning(): Promise<boolean> {
    try {
      const dbStats = await this.database.getStats()
      if (this.isRunning !== dbStats.isRunning) {
        this.isRunning = dbStats.isRunning
      }
      return this.isRunning
    } catch (error) {
      return this.isRunning
    }
  }

  async getCurrentTradingPairs(): Promise<string[]> {
    return this.analyzer.getSymbols()
  }

  async getPairSelectionStats() {
    return await this.analyzer.getCurrentPairStats()
  }

  async refreshTradingPairs(): Promise<string[]> {
    return await this.analyzer.refreshPairs()
  }

  getAnalysisStatus() {
    return {
      isRunning: this.analyzer.isRunning(),
      symbols: this.analyzer.getSymbols(),
      mode: "dynamic",
    }
  }
}

// Singleton instance
const tradingBot = new TradingBot()

export const startBot = (config: BotConfig) => tradingBot.start(config)
export const stopBot = () => tradingBot.stop()
export const getBotStats = () => tradingBot.getStats()
export const getTradeHistory = () => tradingBot.getTradeHistory()
export const getOpenTrades = () => tradingBot.getOpenTrades()
export const getBotLogs = () => tradingBot.getLogs()
export const isBotRunning = async () => await tradingBot.isRunning()
export const getCurrentTradingPairs = () => tradingBot.getCurrentTradingPairs()
export const getPairSelectionStats = () => tradingBot.getPairSelectionStats()
export const refreshTradingPairs = () => tradingBot.refreshTradingPairs()
export const getAnalysisStatus = () => tradingBot.getAnalysisStatus()
