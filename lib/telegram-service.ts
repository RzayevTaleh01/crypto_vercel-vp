import { config } from "dotenv"

// Load environment variables if not in Next.js runtime
if (typeof window === 'undefined' && !process.env.VERCEL) {
  config({ path: ".env.local" })
}

export class TelegramService {
  private botToken: string
  private chatId: string

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || ""
    this.chatId = process.env.TELEGRAM_CHAT_ID || ""
  }

  async sendAlert(title: string, message: string, type: "success" | "error" | "warning" = "success") {
    if (!this.botToken || !this.chatId) {
      console.log("📱 Telegram not configured:", title, message)
      return
    }

    try {
      const emoji = type === "success" ? "✅" : type === "error" ? "❌" : "⚠️"
      const fullMessage = `${emoji} ${title}\n\n${message}`

      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: fullMessage,
          parse_mode: "HTML",
        }),
      })

      if (!response.ok) {
        console.error("Telegram send failed:", await response.text())
      }
    } catch (error: any) {
      console.error("Telegram error:", error.message)
    }
  }

  async sendMessage(message: string) {
    return this.sendAlert("Bot Message", message)
  }
}