import { BinanceTestnetService } from "./binance-testnet-service"
import { NeonDatabaseService } from "./neon-database-service"
import { TechnicalAnalysis } from "./technical-analysis" // Import TechnicalAnalysis
import type { TickerData } from "./ticker-data" // Declare TickerData variable

interface PairAnalysis {
  symbol: string
  score: number
  volume: number
  priceChange: number
  volatility: number
  liquidity: number
  technicalScore: number
  reasons: string[]
}

interface SelectionCriteria {
  minVolume: number
  minLiquidity: number
  maxVolatility: number
  topPairsCount: number
  excludeSymbols: string[]
}

export class DynamicPairSelector {
  private binance: BinanceTestnetService
  private database: NeonDatabaseService
  private lastSelection: string[] = []
  private lastUpdate = 0
  private updateInterval = 300000 // 5 minutes

  constructor() {
    this.binance = new BinanceTestnetService()
    this.database = new NeonDatabaseService()
  }

  async selectBestTradingPairs(criteria?: Partial<SelectionCriteria>): Promise<string[]> {
    try {
      const now = Date.now()

      // Use cached selection if recent
      if (now - this.lastUpdate < this.updateInterval && this.lastSelection.length > 0) {
        await this.database.addLog("DEBUG", "Cached trading pairs istifadə edilir", {
          pairs: this.lastSelection,
          cacheAge: Math.round((now - this.lastUpdate) / 1000),
        })
        return this.lastSelection
      }

      await this.database.addLog("INFO", "Bütün trading pairs analiz edilir...")

      const defaultCriteria: SelectionCriteria = {
        minVolume: 500000, // Testnet üçün daha aşağı həcm tələbi (500K USDT)
        minLiquidity: 5000, // Testnet üçün daha aşağı likvidlik tələbi (5K USDT)
        maxVolatility: 25, // Testnet üçün daha çox volatilityə icazə (25%)
        topPairsCount: 8, // Daha çox pair seçimi (8 ədəd)
        excludeSymbols: [
          "BTCDOMUSDT", "DEFIUSDT", "USDCUSDT", "BUSDUSDT", "DAIUSDT", 
          "TUSDUSDT", "USTCUSDT", "USDPUSDT", "FDUSDUSDT" // Daha çox stablecoin xaric
        ],
        ...criteria,
      }

      let allTickers: TickerData[] = []
      const maxRetries = 3
      const retryDelayMs = 5000 // 5 saniyə

      for (let i = 0; i < maxRetries; i++) {
        try {
          await this.database.addLog(
            "DEBUG",
            `Binance API-dən bütün ticker məlumatları çəkilir (cəhd ${i + 1}/${maxRetries})...`,
          )
          allTickers = await this.binance.getAllTickers()
          if (allTickers.length > 0) {
            await this.database.addLog("INFO", `Binance API-dən ${allTickers.length} ticker məlumatı uğurla çəkildi.`)
            break // Uğurlu, yenidən cəhd dövrəsindən çıx
          } else {
            await this.database.addLog(
              "WARNING",
              `Binance API-dən boş ticker məlumatı alındı (cəhd ${i + 1}/${maxRetries}). Yenidən cəhd edilir...`,
            )
          }
        } catch (error: any) {
          await this.database.addLog(
            "ERROR",
            `Binance API getAllTickers xətası (cəhd ${i + 1}/${maxRetries}): ${error.message}`,
            { error: error.message },
          )
          if (i < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
          } else {
            throw error // Bütün cəhdlər uğursuz olarsa, xətanı yenidən at
          }
        }
      }

      if (allTickers.length === 0) {
        await this.database.addLog("ERROR", "Bütün cəhdlərdən sonra Binance API-dən ticker məlumatları alınmadı.")
        return [] // Yenidən cəhdlərdən sonra heç bir ticker yoxdursa boş qaytar
      }

      const usdtPairs = allTickers.filter(
        (ticker) =>
          ticker.symbol.endsWith("USDT") &&
          !defaultCriteria.excludeSymbols.includes(ticker.symbol) &&
          !ticker.symbol.includes("UP") && // Kaldıraçlı tokenləri xaric et
          !ticker.symbol.includes("DOWN") &&
          !ticker.symbol.includes("BULL") &&
          !ticker.symbol.includes("BEAR") &&
          !ticker.symbol.includes("3L") && // 3x kaldıraçlı tokenləri xaric et
          !ticker.symbol.includes("3S") &&
          !ticker.symbol.includes("5L") &&
          !ticker.symbol.includes("5S") &&
          !ticker.symbol.startsWith("AUD") && // Fiat pairləri xaric et
          !ticker.symbol.startsWith("EUR") &&
          !ticker.symbol.startsWith("GBP") &&
          ticker.symbol.length <= 12 && // Çox uzun adları xaric et
          Number(ticker.price) > 0 && // Sıfır qiymətli coinləri xaric et
          Number(ticker.volume) > 1000 // Minimum həcm
      )

      await this.database.addLog("INFO", `${usdtPairs.length} USDT trading pair tapıldı`)

      // Analyze each pair
      const pairAnalyses: PairAnalysis[] = []
      let processedCount = 0

      for (const ticker of usdtPairs) {
        try {
          const analysis = await this.analyzePair(ticker)

          // Apply filters
          if (
            analysis.volume >= defaultCriteria.minVolume &&
            analysis.liquidity >= defaultCriteria.minLiquidity &&
            analysis.volatility <= defaultCriteria.maxVolatility
          ) {
            pairAnalyses.push(analysis)
            await this.database.addLog("DEBUG", `Pair ${analysis.symbol} filterlərdən keçdi`, {
              volume: analysis.volume,
              liquidity: analysis.liquidity,
              volatility: analysis.volatility,
            })
          } else {
            await this.database.addLog("DEBUG", `Pair ${analysis.symbol} filterlərdən keçmədi`, {
              volume: analysis.volume,
              minVolume: defaultCriteria.minVolume,
              liquidity: analysis.liquidity,
              minLiquidity: defaultCriteria.minLiquidity,
              volatility: analysis.volatility,
              maxVolatility: defaultCriteria.maxVolatility,
            })
          }

          processedCount++

          // Log progress every 50 pairs
          if (processedCount % 50 === 0) {
            await this.database.addLog("DEBUG", `Analiz progress: ${processedCount}/${usdtPairs.length}`)
          }
        } catch (error: any) {
          await this.database.addLog("ERROR", `Pair ${ticker.symbol} analiz xətası`, { error: error.message })
          continue // Skip pairs that fail analysis
        }
      }

      // Sort by score and select top pairs
      pairAnalyses.sort((a, b) => b.score - a.score)
      const topPairs = pairAnalyses.slice(0, defaultCriteria.topPairsCount)
      const selectedSymbols = topPairs.map((p) => p.symbol)

      if (selectedSymbols.length === 0) {
        await this.database.addLog(
          "WARNING",
          "Heç bir trading pair təyin edilmiş kriteriyalara uyğun gəlmədi. Kriteriyaları yumşaltmağı düşünün.",
          { criteria: defaultCriteria },
        )
      } else {
        // Log selection results
        await this.database.addLog("INFO", "Ən yaxşı trading pairs seçildi", {
          totalAnalyzed: pairAnalyses.length,
          topPairs: topPairs.map((p) => ({
            symbol: p.symbol,
            score: p.score,
            volume: `${(p.volume / 1000000).toFixed(1)}M`,
            change: `${p.priceChange.toFixed(2)}%`,
            reasons: p.reasons.slice(0, 2), // First 2 reasons
          })),
        })

        // Detailed analysis for each selected pair
        for (const pair of topPairs) {
          await this.database.addLog("INFO", `Seçilən pair: ${pair.symbol}`, {
            score: pair.score,
            volume: `${(pair.volume / 1000000).toFixed(1)}M USDT`,
            priceChange: `${pair.priceChange.toFixed(2)}%`,
            volatility: `${pair.volatility.toFixed(2)}%`,
            liquidity: `${(pair.liquidity / 1000).toFixed(0)}K`,
            technicalScore: pair.technicalScore,
            reasons: pair.reasons,
          })
        }
      }

      this.lastSelection = selectedSymbols
      this.lastUpdate = now

      return selectedSymbols
    } catch (error: any) {
      await this.database.addLog("ERROR", "Trading pairs seçimi ümumi xətası", { error: error.message })
      // Fallback pairs removed. Returning an empty array means no pairs will be traded if selection fails.
      return []
    }
  }

  private async analyzePair(ticker: any): Promise<PairAnalysis> {
    const symbol = ticker.symbol
    const price = Number(ticker.price)
    const priceChange = Number(ticker.priceChangePercent)
    const volume = Number(ticker.quoteAssetVolume) // Use quoteAssetVolume for USDT volume

    let score = 0
    let technicalScore = 0
    const reasons: string[] = []

    await this.database.addLog("DEBUG", `Analiz edilir: ${symbol}`, {
      price,
      priceChange,
      volume: `${(volume / 1000000).toFixed(1)}M USDT`,
    })

    // Volume scoring (30% of total score)
    const volumeScore = Math.min(30, (volume / 10000000) * 30) // 10M USDT = max score
    score += volumeScore
    if (volumeScore > 20) {
      reasons.push(`Yüksək həcim (${(volume / 1000000).toFixed(1)}M USDT)`)
    }
    await this.database.addLog("DEBUG", `${symbol} - Həcm Skoru: ${volumeScore.toFixed(2)}`)

    // Volatility scoring (25% of total score)
    const absChange = Math.abs(priceChange)
    if (absChange >= 2 && absChange <= 8) {
      const volatilityScore = 25 - Math.abs(absChange - 4) * 3 // Optimal around 4%
      score += volatilityScore
      technicalScore += volatilityScore
      reasons.push(`Optimal volatility (${absChange.toFixed(2)}%)`)
    } else if (absChange > 8) {
      score += 10 // High volatility, lower score
      reasons.push(`Yüksək volatility (${absChange.toFixed(2)}%)`)
    }
    await this.database.addLog("DEBUG", `${symbol} - Volatillik Skoru: ${score - volumeScore}`)

    // Price change momentum (20% of total score)
    if (Math.abs(priceChange) > 1) {
      const momentumScore = Math.min(20, Math.abs(priceChange) * 2)
      score += momentumScore
      technicalScore += momentumScore
      reasons.push(`Güclü momentum (${priceChange > 0 ? "+" : ""}${priceChange.toFixed(2)}%)`)
    }
    await this.database.addLog("DEBUG", `${symbol} - Momentum Skoru: ${score - volumeScore - (score - volumeScore)}`)

    // Try to get technical analysis
    try {
      const klines = await this.binance.getKlines(symbol, "5m", 50)
      if (klines.length >= 20) {
        const closes = klines.map((k) => Number(k.close))
        const technicalAnalysis = this.performQuickTechnicalAnalysis(closes, price)

        score += technicalAnalysis.score
        technicalScore += technicalAnalysis.score
        reasons.push(...technicalAnalysis.reasons)
        await this.database.addLog("DEBUG", `${symbol} - Texniki Analiz Skoru: ${technicalAnalysis.score}`)
      } else {
        await this.database.addLog(
          "DEBUG",
          `${symbol} - Texniki analiz üçün kifayət qədər kline datası yoxdur: ${klines.length}`,
        )
      }
    } catch (error: any) {
      await this.database.addLog("ERROR", `${symbol} - Texniki analiz datası alınarkən xəta: ${error.message}`)
      // Skip technical analysis if data unavailable
    }

    // Liquidity estimation (spread-based)
    const spread = Number(ticker.askPrice) - Number(ticker.bidPrice)
    const spreadPercent = (spread / price) * 100
    const liquidity = volume / (spreadPercent + 0.0001) // Higher volume, lower spread = higher liquidity (avoid division by zero)

    if (spreadPercent < 0.1) {
      score += 15
      reasons.push(`Yaxşı likvidlik (${spreadPercent.toFixed(3)}% spread)`)
    }
    await this.database.addLog(
      "DEBUG",
      `${symbol} - Likvidlik Skoru: ${score - technicalScore - (score - volumeScore - (score - volumeScore))}`,
    )

    // Bonus for popular base assets
    const baseAsset = symbol.replace("USDT", "")
    const popularAssets = ["BTC", "ETH", "BNB", "ADA", "SOL", "DOT", "LINK", "AVAX", "MATIC", "ATOM"]
    if (popularAssets.includes(baseAsset)) {
      score += 10
      reasons.push(`Populyar asset (${baseAsset})`)
    }
    await this.database.addLog(
      "DEBUG",
      `${symbol} - Populyarlıq Bonusu: ${score - (score - technicalScore - (score - volumeScore - (score - volumeScore)))}`,
    )

    await this.database.addLog("DEBUG", `${symbol} - Yekun Skor: ${score.toFixed(2)}`, { reasons })

    return {
      symbol,
      score: Math.round(score),
      volume,
      priceChange,
      volatility: absChange,
      liquidity,
      technicalScore,
      reasons,
    }
  }

  private performQuickTechnicalAnalysis(closes: number[], currentPrice: number): { score: number; reasons: string[] } {
    let score = 0
    const reasons: string[] = []

    try {
      // Simple RSI calculation
      if (closes.length >= 14) {
        const rsiValues = TechnicalAnalysis.calculateRSI(closes, 14)
        const rsi = rsiValues[rsiValues.length - 1]

        if (rsi < 35) {
          score += 15
          reasons.push(`RSI oversold (${rsi.toFixed(1)})`)
        } else if (rsi > 65) {
          score += 10
          reasons.push(`RSI overbought (${rsi.toFixed(1)})`)
        }
      }

      // Simple moving average
      if (closes.length >= 20) {
        const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20
        if (currentPrice > sma20) {
          score += 10
          reasons.push(`Price above SMA20`)
        }
      }

      // Trend analysis
      if (closes.length >= 10) {
        const recentPrices = closes.slice(-10)
        const trend = recentPrices[recentPrices.length - 1] - recentPrices[0]
        if (Math.abs(trend) > currentPrice * 0.02) {
          score += 8
          reasons.push(`Strong trend (${trend > 0 ? "bullish" : "bearish"})`)
        }
      }
    } catch (error) {
      // Skip technical analysis on error
      console.error("Quick technical analysis error:", error)
    }

    return { score, reasons }
  }

  async getCurrentSelection(): Promise<string[]> {
    return this.lastSelection
  }

  async forceRefresh(): Promise<string[]> {
    this.lastUpdate = 0
    return await this.selectBestTradingPairs()
  }

  async getSelectionStats(): Promise<{
    lastUpdate: string
    pairCount: number
    nextUpdate: string
  }> {
    const now = Date.now()
    const timeSinceUpdate = now - this.lastUpdate
    const timeUntilUpdate = this.updateInterval - timeSinceUpdate

    return {
      lastUpdate: new Date(this.lastUpdate).toLocaleString("az-AZ"),
      pairCount: this.lastSelection.length,
      nextUpdate: timeUntilUpdate > 0 ? `${Math.round(timeUntilUpdate / 60000)} dəqiqə` : "İndi",
    }
  }
}
