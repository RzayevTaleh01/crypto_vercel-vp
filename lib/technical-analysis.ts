interface OHLCV {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

export class TechnicalAnalysis {
  static calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = []
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      sma.push(sum / period)
    }
    return sma
  }

  static calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = []
    const multiplier = 2 / (period + 1)

    // First EMA is SMA
    const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
    ema.push(sma)

    for (let i = period; i < prices.length; i++) {
      const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]
      ema.push(currentEMA)
    }

    return ema
  }

  static calculateRSI(prices: number[], period = 14): number[] {
    const rsi: number[] = []
    const gains: number[] = []
    const losses: number[] = []

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1]
      gains.push(change > 0 ? change : 0)
      losses.push(change < 0 ? Math.abs(change) : 0)
    }

    // Calculate RSI
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period

      if (avgLoss === 0) {
        rsi.push(100)
      } else {
        const rs = avgGain / avgLoss
        rsi.push(100 - 100 / (1 + rs))
      }
    }

    return rsi
  }

  static calculateMACD(prices: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const emaFast = this.calculateEMA(prices, fastPeriod)
    const emaSlow = this.calculateEMA(prices, slowPeriod)

    const macdLine: number[] = []
    const minLength = Math.min(emaFast.length, emaSlow.length)

    for (let i = 0; i < minLength; i++) {
      macdLine.push(emaFast[i] - emaSlow[i])
    }

    const signalLine = this.calculateEMA(macdLine, signalPeriod)
    const histogram: number[] = []

    for (let i = 0; i < signalLine.length; i++) {
      histogram.push(macdLine[i + (macdLine.length - signalLine.length)] - signalLine[i])
    }

    return { macdLine, signalLine, histogram }
  }

  static detectPattern(ohlcv: OHLCV[]): string {
    if (ohlcv.length < 3) return "INSUFFICIENT_DATA"

    const recent = ohlcv.slice(-3)
    const [prev2, prev1, current] = recent

    // Bullish patterns
    if (current.close > current.open && prev1.close < prev1.open && current.close > prev1.high) {
      return "BULLISH_ENGULFING"
    }

    // Bearish patterns
    if (current.close < current.open && prev1.close > prev1.open && current.close < prev1.low) {
      return "BEARISH_ENGULFING"
    }

    // Doji pattern
    if (Math.abs(current.close - current.open) / current.high - current.low < 0.1) {
      return "DOJI"
    }

    return "NO_PATTERN"
  }

  static calculateVolatility(prices: number[], period = 20): number {
    if (prices.length < period) return 0

    const recentPrices = prices.slice(-period)
    const mean = recentPrices.reduce((a, b) => a + b, 0) / period
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period

    return Math.sqrt(variance)
  }
}
