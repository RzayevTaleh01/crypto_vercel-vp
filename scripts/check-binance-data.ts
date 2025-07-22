import { BinanceTestnetService } from "../lib/binance-testnet-service"
import { NeonDatabaseService } from "../lib/neon-database-service" // For logging

async function checkBinanceData() {
  console.log("🚀 Binance Testnet məlumat çəkmə testi başlayır...")

  const binanceService = new BinanceTestnetService()
  const dbService = new NeonDatabaseService() // Use for logging

  try {
    // 1. Test connection
    console.log("🔗 Binance Testnet bağlantısı yoxlanılır...")
    const isConnected = await binanceService.testConnection()

    if (isConnected) {
      console.log("✅ Binance Testnet bağlantısı uğurlu.")
      await dbService.addLog("INFO", "Binance Testnet bağlantısı uğurlu.")
    } else {
      console.error("❌ Binance Testnet bağlantısı uğursuz.")
      await dbService.addLog("ERROR", "Binance Testnet bağlantısı uğursuz.")
      process.exit(1)
    }

    // 2. Fetch ticker data for a common symbol (e.g., BTCUSDT)
    console.log("📈 BTCUSDT ticker məlumatları çəkilir...")
    const tickerData = await binanceService.getTicker("BTCUSDT")

    if (tickerData && tickerData.symbol === "BTCUSDT") {
      console.log("✅ BTCUSDT ticker məlumatları uğurla çəkildi:")
      console.log(`   Simvol: ${tickerData.symbol}`)
      console.log(`   Cari Qiymət: ${tickerData.price}`)
      console.log(`   24s Dəyişiklik (%): ${tickerData.priceChangePercent}`)
      console.log(`   24s Həcm: ${tickerData.volume}`)
      await dbService.addLog("INFO", "BTCUSDT ticker məlumatları uğurla çəkildi.", {
        symbol: tickerData.symbol,
        price: tickerData.price,
        change: tickerData.priceChangePercent,
      })
    } else {
      console.error("❌ BTCUSDT ticker məlumatları çəkilə bilmədi və ya formatı səhvdir.")
      await dbService.addLog("ERROR", "BTCUSDT ticker məlumatları çəkilə bilmədi.")
      process.exit(1)
    }

    // 3. Fetch klines data for a common symbol (e.g., ETHUSDT)
    console.log("📊 ETHUSDT klines (5m) məlumatları çəkilir...")
    const klinesData = await binanceService.getKlines("ETHUSDT", "5m", 5)

    if (klinesData && klinesData.length > 0) {
      console.log(`✅ ETHUSDT klines məlumatları uğurla çəkildi. Son 5 dəqiqəlik şam:`)
      const lastKline = klinesData[klinesData.length - 1]
      console.log(`   Açılış Vaxtı: ${new Date(lastKline.openTime).toLocaleString()}`)
      console.log(`   Açılış Qiyməti: ${lastKline.open}`)
      console.log(`   Bağlanış Qiyməti: ${lastKline.close}`)
      console.log(`   Həcm: ${lastKline.volume}`)
      await dbService.addLog("INFO", "ETHUSDT klines məlumatları uğurla çəkildi.", {
        symbol: "ETHUSDT",
        klinesCount: klinesData.length,
      })
    } else {
      console.error("❌ ETHUSDT klines məlumatları çəkilə bilmədi və ya boşdur.")
      await dbService.addLog("ERROR", "ETHUSDT klines məlumatları çəkilə bilmədi.")
      process.exit(1)
    }

    console.log("🎉 Binance Testnet məlumat çəkmə testi tamamlandı və uğurlu oldu!")
    process.exit(0)
  } catch (error) {
    console.error("🚨 Test zamanı xəta baş verdi:", error.message)
    await dbService.addLog("ERROR", "Binance Testnet məlumat çəkmə testi zamanı xəta.", { error: error.message })
    process.exit(1)
  }
}

checkBinanceData()
