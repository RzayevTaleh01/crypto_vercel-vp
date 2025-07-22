import crypto from "crypto"

interface TickerData {
  symbol: string
  price: string
  priceChangePercent: string
  volume: string
  high: string
  low: string
  openPrice: string
  lastPrice: string
  bidPrice: string
  askPrice: string
}

interface OrderResponse {
  symbol: string
  orderId: number
  orderListId: number
  clientOrderId: string
  transactTime: number
  price: string
  origQty: string
  executedQty: string
  cummulativeQuoteQty: string
  status: string
  timeInForce: string
  type: string
  side: string
  fills: Array<{
    price: string
    qty: string
    commission: string
    commissionAsset: string
  }>
}

interface AccountInfo {
  makerCommission: number
  takerCommission: number
  buyerCommission: number
  sellerCommission: number
  canTrade: boolean
  canWithdraw: boolean
  canDeposit: boolean
  updateTime: number
  accountType: string
  balances: Array<{
    asset: string
    free: string
    locked: string
  }>
}

interface KlineData {
  openTime: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  closeTime: number
  quoteAssetVolume: string
  numberOfTrades: number
  takerBuyBaseAssetVolume: string
  takerBuyQuoteAssetVolume: string
}

export class BinanceTestnetService {
  private baseUrl = "https://testnet.binance.vision/api/v3"
  private wsUrl = "wss://testnet.binance.vision/ws/"
  private apiKey: string
  private apiSecret: string
  private wsConnection: WebSocket | null = null

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || ""
    this.apiSecret = process.env.BINANCE_API_SECRET || ""

    if (!this.apiKey || !this.apiSecret) {
      console.warn(
        "⚠️ Binance API credentials not found. Please set BINANCE_API_KEY and BINANCE_API_SECRET environment variables to enable trading.",
      )
    }
  }

  private createSignature(queryString: string): string {
    return crypto.createHmac("sha256", this.apiSecret).update(queryString).digest("hex")
  }

  private async makeRequest(
    endpoint: string,
    params: Record<string, any> = {},
    method = "GET",
    signed = false,
    timeout = 20000, // Increased timeout to 20 seconds
  ): Promise<any> {
    let queryString = new URLSearchParams(params).toString()

    if (signed) {
      const timestamp = Date.now()
      queryString += `${queryString ? "&" : ""}timestamp=${timestamp}`
      const signature = this.createSignature(queryString)
      queryString += `&signature=${signature}`
    }

    const url = `${this.baseUrl}${endpoint}${queryString ? "?" + queryString : ""}`

    const headers: Record<string, string> = {
      "X-MBX-APIKEY": this.apiKey,
    }

    if (method === "POST") {
      headers["Content-Type"] = "application/x-www-form-urlencoded"
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        // Log more details about the HTTP error if response is not ok
        console.error(`Binance API HTTP error for ${url}: ${response.status} - ${errorText}`)
        throw new Error(`Binance API error: ${response.status} - ${errorText}`)
      }

      return await response.json()
    } catch (error: any) {
      // Explicitly type error as any for easier access to properties
      clearTimeout(timeoutId)
      // Log more details about the fetch error
      console.error(`Binance API fetch failed for ${url}. Error type: ${error.name}, Message: ${error.message}`)
      throw new Error(`Binance API request failed: ${error.message}`)
    }
  }

  // Market data methods
  async getTicker(symbol: string): Promise<TickerData> {
    const data = await this.makeRequest(`/ticker/24hr`, { symbol })
    return {
      symbol: data.symbol,
      price: data.lastPrice,
      priceChangePercent: data.priceChangePercent,
      volume: data.volume,
      high: data.highPrice,
      low: data.lowPrice,
      openPrice: data.openPrice,
      lastPrice: data.lastPrice,
      bidPrice: data.bidPrice,
      askPrice: data.askPrice,
    }
  }

  async getAllTickers(): Promise<TickerData[]> {
    const data = await this.makeRequest("/ticker/24hr")
    return data.map((ticker: any) => ({
      symbol: ticker.symbol,
      price: ticker.lastPrice,
      priceChangePercent: ticker.priceChangePercent,
      volume: ticker.volume,
      high: ticker.highPrice,
      low: ticker.lowPrice,
      openPrice: ticker.openPrice,
      lastPrice: ticker.lastPrice,
      bidPrice: ticker.bidPrice,
      askPrice: ticker.askPrice,
    }))
  }

  async getKlines(symbol: string, interval = "5m", limit = 100): Promise<KlineData[]> {
    const data = await this.makeRequest("/klines", { symbol, interval, limit })
    return data.map((kline: any[]) => ({
      openTime: kline[0],
      open: kline[1],
      high: kline[2],
      low: kline[3],
      close: kline[4],
      volume: kline[5],
      closeTime: kline[6],
      quoteAssetVolume: kline[7],
      numberOfTrades: kline[8],
      takerBuyBaseAssetVolume: kline[9],
      takerBuyQuoteAssetVolume: kline[10],
    }))
  }

  async getAccountInfo(): Promise<AccountInfo> {
    return await this.makeRequest("/account", {}, "GET", true)
  }

  async getBalance(asset: string): Promise<{ asset: string; free: string; locked: string } | null> {
    const accountInfo = await this.getAccountInfo()
    return accountInfo.balances.find((balance) => balance.asset === asset) || null
  }

  // Trading methods
  async placeOrder(
    symbol: string,
    side: "BUY" | "SELL",
    type: "MARKET" | "LIMIT" = "MARKET",
    quantity: string,
    price?: string,
    timeInForce: "GTC" | "IOC" | "FOK" = "GTC",
  ): Promise<OrderResponse> {
    const params: Record<string, any> = {
      symbol,
      side,
      type,
      quantity,
    }

    if (type === "LIMIT") {
      if (!price) throw new Error("Price is required for LIMIT orders")
      params.price = price
      params.timeInForce = timeInForce
    }

    return await this.makeRequest("/order", params, "POST", true)
  }

  async getOrderStatus(symbol: string, orderId: number): Promise<any> {
    return await this.makeRequest("/order", { symbol, orderId }, "GET", true)
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    return await this.makeRequest("/order", { symbol, orderId }, "DELETE", true)
  }

  async getOpenOrders(symbol?: string): Promise<any[]> {
    const params = symbol ? { symbol } : {}
    return await this.makeRequest("/openOrders", params, "GET", true)
  }

  // Helper methods
  async calculateQuantity(symbol: string, usdtAmount: number): Promise<string> {
    const ticker = await this.getTicker(symbol)
    const price = Number.parseFloat(ticker.price)
    const quantity = usdtAmount / price

    // Get symbol info for precision
    const exchangeInfo = await this.makeRequest("/exchangeInfo", { symbol })
    const symbolInfo = exchangeInfo.symbols[0]
    const stepSize = symbolInfo.filters.find((f: any) => f.filterType === "LOT_SIZE").stepSize

    // Calculate precision
    const precision = stepSize.indexOf("1") - 1
    return quantity.toFixed(Math.max(0, precision))
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest("/ping", {}, "GET", false, 5000)
      return true
    } catch (error: any) {
      console.error(`Binance Testnet ping failed: ${error.message}. Error type: ${error.name}`) // Log specific error for ping
      return false
    }
  }

  async getServerTime(): Promise<number> {
    const response = await this.makeRequest("/time")
    return response.serverTime
  }

  // WebSocket connection
  connectWebSocket(symbols: string[], onPriceUpdate: (symbol: string, price: number, change: number) => void) {
    if (this.wsConnection) {
      this.wsConnection.close()
    }

    const streams = symbols.map((symbol) => `${symbol.toLowerCase()}@ticker`).join("/")
    const wsUrl = `${this.wsUrl}${streams}`

    this.wsConnection = new WebSocket(wsUrl)

    this.wsConnection.onopen = () => {
      console.log("✅ WebSocket connected to Binance testnet")
    }

    this.wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.stream && data.data) {
          const ticker = data.data
          const symbol = ticker.s
          const price = Number.parseFloat(ticker.c)
          const change = Number.parseFloat(ticker.P)
          onPriceUpdate(symbol, price, change)
        }
      } catch (error) {
        console.error("WebSocket message parsing error:", error)
      }
    }

    this.wsConnection.onerror = (error) => {
      console.error("WebSocket error:", error)
    }

    this.wsConnection.onclose = () => {
      console.log("WebSocket connection closed, reconnecting...")
      setTimeout(() => {
        this.connectWebSocket(symbols, onPriceUpdate)
      }, 5000)
    }
  }
}
