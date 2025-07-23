"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Play,
  Square,
  TrendingUp,
  DollarSign,
  Activity,
  Bot,
  Bell,
  Database,
  Wifi,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
} from "lucide-react"

// Add these imports at the top of the file
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"

interface BotStats {
  totalCapital: number
  tradingCapital: number
  totalProfit: number
  isRunning: boolean
  tradesCount: number
  winRate?: number
  maxDrawdown?: number
}

interface Trade {
  id: string
  symbol: string
  type: "BUY" | "SELL"
  amount: number
  price: number
  profit?: number
  timestamp: string
  status: "OPEN" | "CLOSED"
}

// Update BotConfig interface
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

interface LogEntry {
  timestamp: string
  level: string
  message: string
}

export default function TradingBotDashboard() {
  const [stats, setStats] = useState<BotStats>({
    totalCapital: 20,
    tradingCapital: 2,
    totalProfit: 0,
    isRunning: false,
    tradesCount: 0,
    winRate: 0,
    maxDrawdown: 0,
  })

  // Update config state initialization
  const [config, setConfig] = useState<BotConfig>({
    initialCapital: 20,
    tradePercentage: 10,
    buyThreshold: -2,
    sellThreshold: 3,
    telegramEnabled: true,
    riskManagement: {
      maxDailyLoss: 10,
      maxOpenTrades: 5,
      stopLossPercentage: 5,
    },
    technicalIndicators: {
      useRSI: true,
      useMACD: true,
      useSMA: true,
    },
  })

  const [trades, setTrades] = useState<Trade[]>([])
  const [portfolio, setPortfolio] = useState<Trade[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)

  const [dbStatus, setDbStatus] = useState<{
    status: string
    database: string
    message?: string
  }>({ status: "unknown", database: "unknown" })

  // Fetch functions
  const fetchStats = async () => {
    try {
      const response = await fetch("/api/bot/balance")
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("Stats xətası:", error)
      // Set default stats if API fails
      setStats({
        totalCapital: 20,
        tradingCapital: 2,
        totalProfit: 0,
        isRunning: false,
        tradesCount: 0,
        winRate: 0,
        maxDrawdown: 0,
      })
    }
  }

  const fetchTrades = async () => {
    try {
      const response = await fetch("/api/bot/history")
      const data = await response.json()
      setTrades(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Trades xətası:", error)
    }
  }

  const fetchPortfolio = async () => {
    try {
      const response = await fetch("/api/bot/portfolio")
      const data = await response.json()
      setPortfolio(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Portfolio xətası:", error)
    }
  }

  const fetchLogs = async () => {
    try {
      const response = await fetch("/api/bot/logs")
      const data = await response.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Logs xətası:", error)
    }
  }

  const checkDatabaseHealth = async () => {
    try {
      const response = await fetch("/api/db/health")
      const data = await response.json()
      setDbStatus(data)
    } catch (error) {
      setDbStatus({ status: "error", database: "error", message: "Bağlantı xətası" })
    }
  }

  const initializeDatabase = async () => {
    try {
      setLoading(true)
      console.log("Database initialization başlayır...")
      const response = await fetch("/api/db/init", { 
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log("Database response:", data)

      if (data.success) {
        setDbStatus({ status: "healthy", database: "connected", message: "İnisializasiya edildi" })
        await fetchStats()
        toast({
          title: "✅ Database hazır",
          description: "Database uğurla quruldu və hazırdır",
        })
      } else {
        throw new Error(data.error || "Database init xətası")
      }
    } catch (error: any) {
      console.error("Database init xətası:", error)
      toast({
        title: "❌ Database xətası",
        description: error.message || "Database qurula bilmədi",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Inside the TradingBotDashboard component, initialize toast
  const { toast } = useToast()

  // Replace the existing `startBot` function with this updated version:
  const startBot = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/bot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      const data = await response.json()

      if (data.success) {
        setStats((prev) => ({ ...prev, isRunning: true }))
        toast({
          title: "✅ Bot uğurla başladı!",
          description: `Rejim: ${data.mode === "live-testnet" ? "Real Testnet" : "Demo Rejim"}. Binance: ${data.binanceStatus}, Database: ${data.databaseStatus}`,
          action: <ToastAction altText="OK">OK</ToastAction>,
        })
      } else {
        toast({
          title: "❌ Bot başlama xətası",
          description: data.details || data.error || "Naməlum xəta baş verdi.",
          variant: "destructive",
          action: (
            <ToastAction altText="Yenidən cəhd et" onClick={startBot}>
              Yenidən cəhd et
            </ToastAction>
          ),
        })
      }
    } catch (error) {
      console.error("Bot başlama xətası:", error)
      toast({
        title: "❌ Bot başlaya bilmədi",
        description: "Şəbəkə bağlantısını yoxlayın və ya server loglarına baxın.",
        variant: "destructive",
        action: (
          <ToastAction altText="Yenidən cəhd et" onClick={startBot}>
            Yenidən cəhd et
          </ToastAction>
        ),
      })
    } finally {
      setLoading(false)
    }
  }

  const stopBot = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/bot/stop", { method: "POST" })
      const data = await response.json()

      if (data.success) {
        setStats((prev) => ({ ...prev, isRunning: false }))
      }
    } catch (error) {
      console.error("Bot dayandırma xətası:", error)
    } finally {
      setLoading(false)
    }
  }

  // Auto refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats()
      fetchTrades()
      fetchPortfolio()
      fetchLogs()
      checkDatabaseHealth()
    }, 10000)

    // Initial fetch
    fetchStats()
    fetchTrades()
    fetchPortfolio()
    fetchLogs()
    checkDatabaseHealth()

    return () => clearInterval(interval)
  }, [])

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`
  const formatPercentage = (percent: number) => `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Crypto Trading Bot
              </h1>
              <p className="text-gray-600 font-medium">Avtomatik Binance Spot Trading</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge
              variant={stats.isRunning ? "default" : "secondary"}
              className={`px-3 py-1 ${
                stats.isRunning
                  ? "bg-green-100 text-green-800 border-green-200"
                  : "bg-gray-100 text-gray-600 border-gray-200"
              }`}
            >
              <Activity className="h-3 w-3 mr-1" />
              {stats.isRunning ? "İşləyir" : "Dayandırılıb"}
            </Badge>
            <Badge
              variant="outline"
              className={`px-3 py-1 ${
                dbStatus.status === "healthy"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              <Database className="h-3 w-3 mr-1" />
              {dbStatus.status === "healthy" ? "DB Aktiv" : "DB Xəta"}
            </Badge>
            <Badge variant="outline" className="px-3 py-1 bg-blue-50 text-blue-700 border-blue-200">
              <Wifi className="h-3 w-3 mr-1" />
              API Status
            </Badge>
          </div>
        </div>

        {/* Database Status Alert */}
        {dbStatus.status !== "healthy" && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between">
              <div className="text-amber-800">
                <strong>Database Status:</strong> {dbStatus.status} - {dbStatus.database}
                {dbStatus.message && ` (${dbStatus.message})`}
              </div>
              <Button
                onClick={initializeDatabase}
                disabled={loading}
                size="sm"
                className="ml-4 bg-amber-600 hover:bg-amber-700"
              >
                {loading ? "Yüklənir..." : "Database İnisializasiya Et"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-blue-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Ümumi Kapital</CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalCapital)}</div>
              <p className="text-xs text-gray-500 mt-1">Ümumi investisiya</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-green-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Trading Kapital</CardTitle>
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.tradingCapital)}</div>
              <p className="text-xs text-gray-500 mt-1">Aktiv trading məbləği</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-purple-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Ümumi Mənfəət</CardTitle>
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(stats.totalProfit)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats.winRate ? `Uğur nisbəti: ${stats.winRate.toFixed(1)}%` : "Hələ trade yoxdur"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-indigo-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Ümumi Trade-lər</CardTitle>
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Activity className="h-4 w-4 text-indigo-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.tradesCount}</div>
              <p className="text-xs text-gray-500 mt-1">İcra edilmiş əməliyyatlar</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="control" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white shadow-sm border">
            <TabsTrigger value="control" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              İdarəetmə
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Portfel
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Tarixçə
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Tövsiyələr
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Loglar
            </TabsTrigger>
          </TabsList>

          {/* Control Panel */}
          <TabsContent value="control">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center">
                    <Bot className="h-5 w-5 mr-2 text-blue-600" />
                    Bot Konfiqurasiyası
                  </CardTitle>
                  <CardDescription>Trading parametrlərini tənzimləyin</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="capital" className="text-sm font-medium">
                        Başlanğıc Kapital ($)
                      </Label>
                      <Input
                        id="capital"
                        type="number"
                        value={config.initialCapital}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, initialCapital: Number.parseFloat(e.target.value) || 0 }))
                        }
                        className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tradePercent" className="text-sm font-medium">
                        Trade Faizi (%)
                      </Label>
                      <Input
                        id="tradePercent"
                        type="number"
                        value={config.tradePercentage}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, tradePercentage: Number.parseFloat(e.target.value) || 0 }))
                        }
                        className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="buyThreshold" className="text-sm font-medium">
                        Alış Hədd (%)
                      </Label>
                      <Input
                        id="buyThreshold"
                        type="number"
                        step="0.1"
                        value={config.buyThreshold}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, buyThreshold: Number.parseFloat(e.target.value) || 0 }))
                        }
                        className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sellThreshold" className="text-sm font-medium">
                        Satış Hədd (%)
                      </Label>
                      <Input
                        id="sellThreshold"
                        type="number"
                        step="0.1"
                        value={config.sellThreshold}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, sellThreshold: Number.parseFloat(e.target.value) || 0 }))
                        }
                        className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Bell className="h-4 w-4 text-gray-600" />
                      <Label htmlFor="telegram" className="text-sm font-medium">
                        Telegram Bildirişləri
                      </Label>
                    </div>
                    <Switch
                      id="telegram"
                      checked={config.telegramEnabled}
                      onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, telegramEnabled: checked }))}
                    />
                  </div>
                  <Separator />

                  <h3 className="text-lg font-semibold text-gray-800 mt-4">Risk İdarəetməsi</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxDailyLoss" className="text-sm font-medium">
                        Max Gündəlik Zərər (%)
                      </Label>
                      <Input
                        id="maxDailyLoss"
                        type="number"
                        step="0.1"
                        value={config.riskManagement.maxDailyLoss}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            riskManagement: {
                              ...prev.riskManagement,
                              maxDailyLoss: Number.parseFloat(e.target.value) || 0,
                            },
                          }))
                        }
                        className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxOpenTrades" className="text-sm font-medium">
                        Max Açıq Trade-lər
                      </Label>
                      <Input
                        id="maxOpenTrades"
                        type="number"
                        value={config.riskManagement.maxOpenTrades}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            riskManagement: {
                              ...prev.riskManagement,
                              maxOpenTrades: Number.parseInt(e.target.value) || 0,
                            },
                          }))
                        }
                        className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="stopLossPercentage" className="text-sm font-medium">
                        Stop Loss Faizi (%)
                      </Label>
                      <Input
                        id="stopLossPercentage"
                        type="number"
                        step="0.1"
                        value={config.riskManagement.stopLossPercentage}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            riskManagement: {
                              ...prev.riskManagement,
                              stopLossPercentage: Number.parseFloat(e.target.value) || 0,
                            },
                          }))
                        }
                        className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <Separator />

                  <h3 className="text-lg font-semibold text-gray-800 mt-4">Texniki Göstəricilər</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <BarChart3 className="h-4 w-4 text-gray-600" />
                        <Label htmlFor="useRSI" className="text-sm font-medium">
                          RSI (Relative Strength Index)
                        </Label>
                      </div>
                      <Switch
                        id="useRSI"
                        checked={config.technicalIndicators.useRSI}
                        onCheckedChange={(checked) =>
                          setConfig((prev) => ({
                            ...prev,
                            technicalIndicators: { ...prev.technicalIndicators, useRSI: checked },
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <BarChart3 className="h-4 w-4 text-gray-600" />
                        <Label htmlFor="useMACD" className="text-sm font-medium">
                          MACD (Moving Average Convergence Divergence)
                        </Label>
                      </div>
                      <Switch
                        id="useMACD"
                        checked={config.technicalIndicators.useMACD}
                        onCheckedChange={(checked) =>
                          setConfig((prev) => ({
                            ...prev,
                            technicalIndicators: { ...prev.technicalIndicators, useMACD: checked },
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <BarChart3 className="h-4 w-4 text-gray-600" />
                        <Label htmlFor="useSMA" className="text-sm font-medium">
                          SMA (Simple Moving Average)
                        </Label>
                      </div>
                      <Switch
                        id="useSMA"
                        checked={config.technicalIndicators.useSMA}
                        onCheckedChange={(checked) =>
                          setConfig((prev) => ({
                            ...prev,
                            technicalIndicators: { ...prev.technicalIndicators, useSMA: checked },
                          }))
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-green-600" />
                    Bot İdarəetmə
                  </CardTitle>
                  <CardDescription>Trading bot-u başladın və ya dayandırın</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex space-x-4">
                    <Button
                      onClick={startBot}
                      disabled={stats.isRunning || loading}
                      className="flex-1 bg-green-600 hover:bg-green-700 shadow-lg"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {loading ? "Başlayır..." : "Bot-u Başlat"}
                    </Button>
                    <Button
                      onClick={stopBot}
                      disabled={!stats.isRunning || loading}
                      variant="destructive"
                      className="flex-1 shadow-lg"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      {loading ? "Dayandırır..." : "Bot-u Dayandır"}
                    </Button>
                  </div>

                  <Alert className={`border-0 ${stats.isRunning ? "bg-green-50" : "bg-gray-50"}`}>
                    {stats.isRunning ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-gray-600" />
                    )}
                    <AlertDescription className={stats.isRunning ? "text-green-800" : "text-gray-700"}>
                      {stats.isRunning
                        ? "Bot aktiv şəkildə bazarları izləyir və konfiqurasiyaya əsasən trade-lər edir."
                        : "Bot hazırda dayandırılıb. Avtomatik trading-ə başlamaq üçün 'Bot-u Başlat' düyməsini basın."}
                    </AlertDescription>
                  </Alert>

                  {dbStatus.status === "healthy" && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-2 text-blue-800">
                        <Wifi className="h-4 w-4" />
                        <span className="text-sm font-medium">Sistem Status</span>
                      </div>
                      <div className="mt-2 text-sm text-blue-700">
                        <div className="flex justify-between">
                          <span>Database:</span>
                          <span className="font-medium">✅ Qoşulub</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Binance Testnet:</span>
                          <span className="font-medium">✅ Aktiv</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Telegram:</span>
                          <span className="font-medium">{config.telegramEnabled ? "✅ Aktiv" : "❌ Deaktiv"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Portfolio */}
          <TabsContent value="portfolio">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-900">Açıq Pozisiyalar</CardTitle>
                <CardDescription>Hazırda aktiv olan trade-lər</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Simvol</TableHead>
                      <TableHead>Növ</TableHead>
                      <TableHead>Məbləğ</TableHead>
                      <TableHead>Giriş Qiyməti</TableHead>
                      <TableHead>Cari P&L</TableHead>
                      <TableHead>Vaxt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                          Açıq pozisiya yoxdur
                        </TableCell>
                      </TableRow>
                    ) : (
                      portfolio.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell className="font-medium">{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge variant={trade.type === "BUY" ? "default" : "secondary"}>{trade.type}</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(trade.amount)}</TableCell>
                          <TableCell>{formatCurrency(trade.price)}</TableCell>
                          <TableCell className={trade.profit && trade.profit >= 0 ? "text-green-600" : "text-red-600"}>
                            {trade.profit ? formatCurrency(trade.profit) : "-"}
                          </TableCell>
                          <TableCell>{new Date(trade.timestamp).toLocaleString("az-AZ")}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-900">Trade Tarixçəsi</CardTitle>
                <CardDescription>Bütün icra edilmiş trade-lərin tam tarixçəsi</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Simvol</TableHead>
                      <TableHead>Növ</TableHead>
                      <TableHead>Məbləğ</TableHead>
                      <TableHead>Qiymət</TableHead>
                      <TableHead>Mənfəət</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vaxt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                          Hələ trade icra edilməyib
                        </TableCell>
                      </TableRow>
                    ) : (
                      trades.slice(0, 10).map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell className="font-medium">{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge variant={trade.type === "BUY" ? "default" : "secondary"}>{trade.type}</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(trade.amount)}</TableCell>
                          <TableCell>{formatCurrency(trade.price)}</TableCell>
                          <TableCell className={trade.profit && trade.profit >= 0 ? "text-green-600" : "text-red-600"}>
                            {trade.profit ? formatCurrency(trade.profit) : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={trade.status === "CLOSED" ? "default" : "outline"}>{trade.status}</Badge>
                          </TableCell>
                          <TableCell>{new Date(trade.timestamp).toLocaleString("az-AZ")}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suggestions */}
          <TabsContent value="suggestions">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-900">Tövsiyə Edilən Coinlər</CardTitle>
                <CardDescription>Bazar analizinə əsasən AI tövsiyələri</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { symbol: "BTCUSDT", reason: "Populyar trading cütü", change: 0 },
                    { symbol: "ETHUSDT", reason: "Yüksək likvidlik", change: 0 },
                    { symbol: "BNBUSDT", reason: "Exchange token", change: 0 },
                    { symbol: "ADAUSDT", reason: "Güclü fundamentals", change: 0 },
                    { symbol: "DOTUSDT", reason: "Ekosistem inkişafı", change: 0 },
                    { symbol: "LINKUSDT", reason: "Oracle lideri", change: 0 },
                  ].map((suggestion, index) => (
                    <Card key={index} className="border border-blue-100 bg-gradient-to-br from-white to-blue-50">
                      <CardContent className="p-4">
                        <div className="flex flex-col space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-blue-900">{suggestion.symbol}</span>
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200">Tövsiyə</Badge>
                          </div>
                          <p className="text-sm text-gray-600">{suggestion.reason}</p>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">24s Dəyişiklik</span>
                            <span className="font-medium text-gray-700">{suggestion.change.toFixed(2)}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs */}
          <TabsContent value="logs">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-900">Sistem Logları</CardTitle>
                <CardDescription>Real-vaxt bot fəaliyyəti və sistem mesajları</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-gray-400">Log məlumatları yoxdur</p>
                  ) : (
                    <div className="space-y-1">
                      {logs.map((log, index) => (
                        <div key={index} className="text-sm font-mono">
                          <span className="text-gray-400">[{new Date(log.timestamp).toLocaleTimeString("az-AZ")}]</span>
                          <span
                            className={`ml-2 ${
                              log.level === "ERROR"
                                ? "text-red-400"
                                : log.level === "WARNING"
                                  ? "text-yellow-400"
                                  : "text-green-400"
                            }`}
                          >
                            {log.level}
                          </span>
                          <span className="text-gray-300 ml-2">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
