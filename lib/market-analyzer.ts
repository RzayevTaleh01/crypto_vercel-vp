import { BinanceTestnetService } from "./binance-testnet-service"
import { TechnicalAnalysis } from "./technical-analysis"
import { NeonDatabaseService, type BotConfig } from "./neon-database-service"
import { DynamicPairSelector } from "./dynamic-pair-selector"

interface MarketData {
  symbol: string
  price: number
  priceChangePercent: number
  volume: number
  high: number
  low: number
  openPrice: number
  timestamp: number
}

interface TechnicalIndicators {
  rsi: number
  macd: {
    macd: number
    signal: number
    histogram: number
  }
  sma20: number
  sma50: number
  ema12: number
  ema26: number
}

interface AnalysisResult {
  symbol: string
  marketData: MarketData
  technicalIndicators: TechnicalIndicators
  signals: {
    rsi: "BUY" | "SELL" | "NEUTRAL"
    macd: "BUY" | "SELL" | "NEUTRAL"
    sma: "BUY" | "SELL" | "NEUTRAL"
    overall: "BUY" | "SELL" | "NEUTRAL"
  }
  confidence: number
  reasons: string[]
  timestamp: number
}

export class MarketAnalyzer {
  private binance: BinanceTestnetService
  private database: NeonDatabaseService
  private pairSelector: DynamicPairSelector
  private analysisInterval: NodeJS.Timeout | null = null
  private pairUpdateInterval: NodeJS.Timeout | null = null
  private isRunning = false
  private symbols: string[] = []
  private config: BotConfig | null = null

  constructor() {
    this.binance = new BinanceTestnetService()
    this.database = new NeonDatabaseService()
    this.pairSelector = new DynamicPairSelector()
  }

  async startAnalysis() {
    if (this.isRunning) {
      await this.stopAnalysis()
    }

    this.isRunning = true

    // Fetch initial config
    this.config = await this.database.getConfig()
    if (!this.config) {
      await this.database.addLog("ERROR", "Bot konfiqurasiyası tapılmadı, analiz başlaya bilmədi.")
      throw new Error("Bot configuration not found.")
    }

    await this.database.addLog("INFO", "Dynamic market analysis başladı", {
      config: {
        useRSI: this.config.technicalIndicators.useRSI,
        useMACD: this.config.technicalIndicators.useMACD,
        useSMA: this.config.technicalIndicators.useSMA,
        tradingPairs: this.config.tradingPairs.length,
      },
    })

    // Initial pair selection
    await this.updateTradingPairs()

    // Start analysis loop (every 30 seconds)
    this.analysisInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.performAnalysis()
      }
    }, 30000)

    // Start pair update loop (every 5 minutes)
    this.pairUpdateInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.updateTradingPairs()
      }
    }, 300000)

    console.log("✅ Dynamic market analysis started")
  }

  async stopAnalysis() {
    this.isRunning = false

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval)
      this.analysisInterval = null
    }

    if (this.pairUpdateInterval) {
      clearInterval(this.pairUpdateInterval)
      this.pairUpdateInterval = null
    }

    await this.database.addLog("INFO", "Market analysis dayandırıldı")
    console.log("🛑 Market analysis stopped")
  }

  private async updateTradingPairs() {
    try {
      await this.database.addLog("INFO", "Trading pairs yenilənir...")

      const newPairs = await this.pairSelector.selectBestTradingPairs()
      const oldPairs = [...this.symbols]

      this.symbols = newPairs

      // Update bot_config in database with newly selected pairs
      if (this.config) {
        // Fetch the latest config to ensure we don't overwrite other settings
        const latestConfig = await this.database.getConfig()
        if (latestConfig) {
          await this.database.updateConfig({
            ...latestConfig,
            tradingPairs: newPairs, // Update only the tradingPairs
          })
          await this.database.addLog("INFO", "Bot konfiqurasiyasında trading pairs yeniləndi", { pairs: newPairs })
        } else {
          await this.database.addLog("WARNING", "Konfiqurasiya yenilənə bilmədi: aktiv konfiqurasiya tapılmadı.")
        }
      } else {
        await this.database.addLog("WARNING", "Konfiqurasiya yenilənə bilmədi: bot konfiqurasiyası null.")
      }

      // Log pair changes
      const added = newPairs.filter((p) => !oldPairs.includes(p))
      const removed = oldPairs.filter((p) => !newPairs.includes(p))

      if (added.length > 0 || removed.length > 0) {
        await this.database.addLog("INFO", "Trading pairs dəyişdirildi", {
          newPairs,
          added,
          removed,
          total: newPairs.length,
        })
      } else if (newPairs.length === 0) {
        await this.database.addLog("WARNING", "Dinamik pair seçimi nəticəsində heç bir pair tapılmadı.", {
          reason: "Kriteriyalar çox sərt ola bilər və ya bazar şərtləri uyğun deyil.",
        })
      } else {
        await this.database.addLog("INFO", "Trading pairs dəyişmədi", {
          currentPairs: newPairs,
          total: newPairs.length,
        })
      }

      const stats = await this.pairSelector.getSelectionStats()
      await this.database.addLog("DEBUG", "Pair selection stats", stats)
    } catch (error) {
      await this.database.addLog("ERROR", "Trading pairs yenilənmə xətası", { error: error.message })
    }
  }

  private async performAnalysis() {
    try {
      if (this.symbols.length === 0) {
        await this.database.addLog("WARNING", "Analiz üçün trading pair yoxdur")
        return
      }

      if (!this.config) {
        this.config = await this.database.getConfig() // Re-fetch if null
        if (!this.config) {
          await this.database.addLog("ERROR", "Analiz üçün bot konfiqurasiyası yoxdur.")
          return
        }
      }

      await this.database.addLog("DEBUG", "Analysis dövrü başladı", {
        symbols: this.symbols,
        count: this.symbols.length,
        activeIndicators: this.config.technicalIndicators,
      })

      const analysisResults: AnalysisResult[] = []

      for (const symbol of this.symbols) {
        try {
          const analysis = await this.analyzeSymbol(symbol)
          analysisResults.push(analysis)
          await this.saveAnalysisResult(analysis)

          // Log analysis result
          await this.database.addLog("INFO", `${symbol} analiz tamamlandı`, {
            signal: analysis.signals.overall,
            confidence: analysis.confidence,
            price: analysis.marketData.price,
            change: analysis.marketData.priceChangePercent,
            volume: `${(analysis.marketData.volume / 1000000).toFixed(1)}M`,
            rsi: analysis.technicalIndicators.rsi.toFixed(1),
            macd: analysis.technicalIndicators.macd.histogram.toFixed(2),
            sma20: analysis.technicalIndicators.sma20.toFixed(4),
            reasons: analysis.reasons.slice(0, 3), // Top 3 reasons
          })
        } catch (symbolError) {
          // Log the specific error from analyzeSymbol
          await this.database.addLog("ERROR", `${symbol} analiz xətası: ${symbolError.message}`, {
            error: symbolError.message,
          })
        }
      }

      // Find best opportunities
      const buyOpportunities = analysisResults
        .filter((r) => r.signals.overall === "BUY" && r.confidence > 60)
        .sort((a, b) => b.confidence - a.confidence)

      const sellSignals = analysisResults
        .filter((r) => r.signals.overall === "SELL" && r.confidence > 50)
        .sort((a, b) => b.confidence - a.confidence)

      await this.database.addLog("INFO", "Analysis dövrü tamamlandı", {
        totalAnalyzed: analysisResults.length,
        buyOpportunities: buyOpportunities.length,
        sellSignals: sellSignals.length,
        topBuyOpportunity: buyOpportunities[0]
          ? {
              symbol: buyOpportunities[0].symbol,
              confidence: buyOpportunities[0].confidence,
              reasons: buyOpportunities[0].reasons.slice(0, 2),
            }
          : null,
      })
    } catch (error) {
      await this.database.addLog("ERROR", "Analysis dövrü xətası", { error: error.message })
    }
  }

  private async analyzeSymbol(symbol: string): Promise<AnalysisResult> {
    let ticker: any
    let klines: any[]

    try {
      // Get current market data
      await this.database.addLog("DEBUG", `Fetching ticker for ${symbol}`)
      ticker = await this.binance.getTicker(symbol)
    } catch (error) {
      await this.database.addLog("ERROR", `Failed to fetch ticker for ${symbol}: ${error.message}`, {
        error: error.message,
      })
      throw new Error(`Ticker data fetch failed for ${symbol}: ${error.message}`)
    }

    const marketData: MarketData = {
      symbol: ticker.symbol,
      price: Number(ticker.price),
      priceChangePercent: Number(ticker.priceChangePercent),
      volume: Number(ticker.volume) * Number(ticker.price), // USDT volume
      high: Number(ticker.high),
      low: Number(ticker.low),
      openPrice: Number(ticker.openPrice),
      timestamp: Date.now(),
    }

    try {
      // Get historical data for technical analysis
      await this.database.addLog("DEBUG", `Fetching klines for ${symbol}`)
      klines = await this.binance.getKlines(symbol, "5m", 100)
    } catch (error) {
      await this.database.addLog("ERROR", `Failed to fetch klines for ${symbol}: ${error.message}`, {
        error: error.message,
      })
      throw new Error(`Kline data fetch failed for ${symbol}: ${error.message}`)
    }

    const closePrices = klines.map((k) => Number(k.close))
    const highPrices = klines.map((k) => Number(k.high))
    const lowPrices = klines.map((k) => Number(k.low))
    const volumes = klines.map((k) => Number(k.volume))

    // Calculate technical indicators based on config
    const technicalIndicators: TechnicalIndicators = {
      rsi: 50, // Default
      macd: { macd: 0, signal: 0, histogram: 0 }, // Default
      sma20: marketData.price, // Default
      sma50: marketData.price, // Default
      ema12: marketData.price, // Default
      ema26: marketData.price, // Default
    }

    if (this.config?.technicalIndicators.useRSI && closePrices.length > 0) {
      const rsiValues = TechnicalAnalysis.calculateRSI(closePrices, 14)
      technicalIndicators.rsi = rsiValues[rsiValues.length - 1] || 50
    }

    if (this.config?.technicalIndicators.useSMA && closePrices.length >= 50) {
      const sma20Values = TechnicalAnalysis.calculateSMA(closePrices, 20)
      const sma50Values = TechnicalAnalysis.calculateSMA(closePrices, 50)
      technicalIndicators.sma20 = sma20Values[sma20Values.length - 1] || marketData.price
      technicalIndicators.sma50 = sma50Values[sma50Values.length - 1] || marketData.price
    }

    if (this.config?.technicalIndicators.useMACD && closePrices.length >= 26) {
      const macdValues = TechnicalAnalysis.calculateMACD(closePrices, 12, 26, 9)
      technicalIndicators.macd = {
        macd: macdValues.macdLine[macdValues.macdLine.length - 1] || 0,
        signal: macdValues.signalLine[macdValues.signalLine.length - 1] || 0,
        histogram: macdValues.histogram[macdValues.histogram.length - 1] || 0,
      }
      const ema12Values = TechnicalAnalysis.calculateEMA(closePrices, 12)
      const ema26Values = TechnicalAnalysis.calculateEMA(closePrices, 26)
      technicalIndicators.ema12 = ema12Values[ema12Values.length - 1] || marketData.price
      technicalIndicators.ema26 = ema26Values[ema26Values.length - 1] || marketData.price
    }

    // Generate signals
    const signals = this.generateSignals(marketData, technicalIndicators, this.config?.technicalIndicators)
    const { confidence, reasons } = this.calculateConfidence(
      marketData,
      technicalIndicators,
      signals,
      volumes,
      this.config?.technicalIndicators,
    )

    return {
      symbol,
      marketData,
      technicalIndicators,
      signals,
      confidence,
      reasons,
      timestamp: Date.now(),
    }
  }

  private generateSignals(
    marketData: MarketData,
    indicators: TechnicalIndicators,
    activeIndicators?: BotConfig["technicalIndicators"],
  ) {
    const signals = {
      rsi: "NEUTRAL" as "BUY" | "SELL" | "NEUTRAL",
      macd: "NEUTRAL" as "BUY" | "SELL" | "NEUTRAL",
      sma: "NEUTRAL" as "BUY" | "SELL" | "NEUTRAL",
      overall: "NEUTRAL" as "BUY" | "SELL" | "NEUTRAL",
    }

    // RSI signals
    if (activeIndicators?.useRSI) {
      if (indicators.rsi < 30) {
        signals.rsi = "BUY" // Oversold
      } else if (indicators.rsi > 70) {
        signals.rsi = "SELL" // Overbought
      }
    }

    // MACD signals
    if (activeIndicators?.useMACD) {
      if (indicators.macd.macd > indicators.macd.signal && indicators.macd.histogram > 0) {
        signals.macd = "BUY"
      } else if (indicators.macd.macd < indicators.macd.signal && indicators.macd.histogram < 0) {
        signals.macd = "SELL"
      }
    }

    // SMA signals
    if (activeIndicators?.useSMA) {
      if (marketData.price > indicators.sma20 && indicators.sma20 > indicators.sma50) {
        signals.sma = "BUY" // Price above SMA20 and SMA20 above SMA50
      } else if (marketData.price < indicators.sma20 && indicators.sma20 < indicators.sma50) {
        signals.sma = "SELL" // Price below SMA20 and SMA20 below SMA50
      }
    }

    // Overall signal with weighted scoring
    let buyScore = 0
    let sellScore = 0

    // Weight RSI more heavily for extreme values
    if (signals.rsi === "BUY") buyScore += indicators.rsi < 25 ? 3 : 2
    if (signals.rsi === "SELL") sellScore += indicators.rsi > 75 ? 3 : 2

    // MACD gets standard weight
    if (signals.macd === "BUY") buyScore += 2
    if (signals.macd === "SELL") sellScore += 2

    // SMA trend gets standard weight
    if (signals.sma === "BUY") buyScore += 2
    if (signals.sma === "SELL") sellScore += 2

    if (buyScore > sellScore && buyScore >= 3) {
      signals.overall = "BUY"
    } else if (sellScore > buyScore && sellScore >= 3) {
      signals.overall = "SELL"
    }

    return signals
  }

  private calculateConfidence(
    marketData: MarketData,
    indicators: TechnicalIndicators,
    signals: any,
    volumes: number[],
    activeIndicators?: BotConfig["technicalIndicators"],
  ): { confidence: number; reasons: string[] } {
    let confidence = 0
    const reasons: string[] = []

    // RSI confidence
    if (activeIndicators?.useRSI) {
      if (signals.rsi === "BUY" && indicators.rsi < 25) {
        confidence += 35
        reasons.push(`RSI extremely oversold (${indicators.rsi.toFixed(1)}) - güclü alış siqnalı`)
      } else if (signals.rsi === "BUY" && indicators.rsi < 30) {
        confidence += 25
        reasons.push(`RSI oversold (${indicators.rsi.toFixed(1)}) - alış siqnalı`)
      } else if (signals.rsi === "SELL" && indicators.rsi > 75) {
        confidence += 35
        reasons.push(`RSI extremely overbought (${indicators.rsi.toFixed(1)}) - güclü satış siqnalı`)
      } else if (signals.rsi === "SELL" && indicators.rsi > 70) {
        confidence += 25
        reasons.push(`RSI overbought (${indicators.rsi.toFixed(1)}) - satış siqnalı`)
      }
    }

    // MACD confidence
    if (activeIndicators?.useMACD) {
      if (signals.macd === "BUY" && indicators.macd.histogram > 0) {
        confidence += 25
        reasons.push(`MACD bullish crossover - yuxarı trend başlayır`)
      } else if (signals.macd === "SELL" && indicators.macd.histogram < 0) {
        confidence += 25
        reasons.push(`MACD bearish crossover - aşağı trend başlayır`)
      }
    }

    // SMA trend confidence
    if (activeIndicators?.useSMA) {
      if (signals.sma === "BUY") {
        const trendStrength = ((indicators.sma20 - indicators.sma50) / indicators.sma50) * 100
        if (trendStrength > 2) {
          confidence += 25
          reasons.push(`Güclü yuxarı trend - SMA20 ${trendStrength.toFixed(1)}% yuxarı`)
        } else {
          confidence += 15
          reasons.push(`Yuxarı trend - qiymət SMA20 üzərində`)
        }
      } else if (signals.sma === "SELL") {
        const trendStrength = ((indicators.sma50 - indicators.sma20) / indicators.sma20) * 100
        if (trendStrength > 2) {
          confidence += 25
          reasons.push(`Güclü aşağı trend - SMA20 ${trendStrength.toFixed(1)}% aşağı`)
        } else {
          confidence += 15
          reasons.push(`Aşağı trend - qiymət SMA20 altında`)
        }
      }
    }

    // Volume confirmation
    const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
    const currentVolume = volumes[volumes.length - 1] || 0

    if (currentVolume > avgVolume * 1.5) {
      confidence += 15
      reasons.push(`Yüksək həcim (${((currentVolume / avgVolume - 1) * 100).toFixed(0)}% artıq) - güclü siqnal`)
    } else if (currentVolume > avgVolume * 1.2) {
      confidence += 10
      reasons.push(`Artan həcim - siqnal təsdiqi`)
    }

    // Price momentum
    const momentum = Math.abs(marketData.priceChangePercent)
    if (momentum > 3) {
      confidence += 10
      reasons.push(`Güclü momentum (${marketData.priceChangePercent.toFixed(2)}%)`)
    } else if (momentum > 1.5) {
      confidence += 5
      reasons.push(`Orta momentum (${marketData.priceChangePercent.toFixed(2)}%)`)
    }

    // Multiple timeframe confirmation (using EMA) - only if MACD is active
    if (activeIndicators?.useMACD) {
      if (indicators.ema12 > indicators.ema26 && signals.overall === "BUY") {
        confidence += 10
        reasons.push(`EMA crossover təsdiqi - qısamüddətli trend yuxarı`)
      } else if (indicators.ema12 < indicators.ema26 && signals.overall === "SELL") {
        confidence += 10
        reasons.push(`EMA crossover təsdiqi - qısamüddətli trend aşağı`)
      }
    }

    return { confidence: Math.min(confidence, 100), reasons }
  }

  private async saveAnalysisResult(analysis: AnalysisResult) {
    try {
      await this.database.saveMarketData({
        symbol: analysis.symbol,
        price: analysis.marketData.price,
        priceChangePercent: analysis.marketData.priceChangePercent,
        volume: analysis.marketData.volume,
        high: analysis.marketData.high,
        low: analysis.marketData.low,
        openPrice: analysis.marketData.openPrice,
        rsi: analysis.technicalIndicators.rsi,
        macdSignal: analysis.signals.macd,
        smaSignal: analysis.signals.sma,
        volatility: Math.abs(analysis.marketData.priceChangePercent),
      })
    } catch (error) {
      console.error("Failed to save analysis result:", error)
    }
  }

  async getLatestAnalysis(): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = []

    for (const symbol of this.symbols) {
      try {
        const marketData = await this.database.getLatestMarketData(symbol)
        if (marketData) {
          const analysis: AnalysisResult = {
            symbol,
            marketData: {
              symbol: marketData.symbol,
              price: marketData.price,
              priceChangePercent: marketData.priceChangePercent,
              volume: marketData.volume,
              high: marketData.high,
              low: marketData.low,
              openPrice: marketData.openPrice,
              timestamp: Date.now(),
            },
            technicalIndicators: {
              rsi: marketData.rsi || 50,
              macd: { macd: 0, signal: 0, histogram: 0 },
              sma20: marketData.price,
              sma50: marketData.price,
              ema12: marketData.price,
              ema26: marketData.price,
            },
            signals: {
              rsi:
                marketData.rsi && marketData.rsi < 30
                  ? "BUY"
                  : marketData.rsi && marketData.rsi > 70
                    ? "SELL"
                    : "NEUTRAL",
              macd: (marketData.macdSignal as any) || "NEUTRAL",
              sma: (marketData.smaSignal as any) || "NEUTRAL",
              overall: "NEUTRAL",
            },
            confidence: 0,
            reasons: [],
            timestamp: Date.now(),
          }
          results.push(analysis)
        }
      } catch (error) {
        console.error(`Failed to get analysis for ${symbol}:`, error)
      }
    }

    return results
  }

  isRunning(): boolean {
    return this.isRunning
  }

  getSymbols(): string[] {
    return this.symbols
  }

  async getCurrentPairStats() {
    const stats = await this.pairSelector.getSelectionStats()
    return {
      ...stats,
      currentPairs: this.symbols,
    }
  }

  async refreshPairs(): Promise<string[]> {
    return await this.pairSelector.forceRefresh()
  }
}