export class TelegramService {
  private botToken = process.env.TELEGRAM_BOT_TOKEN || ""
  private chatId = process.env.TELEGRAM_CHAT_ID || ""
  private baseUrl = `https://api.telegram.org/bot${this.botToken}`

  async sendMessage(message: string) {
    if (!this.botToken || !this.chatId) {
      console.log("Telegram not configured, message:", message)
      return
    }

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: "HTML",
        }),
      })

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`)
      }

      console.log("Telegram message sent:", message)
    } catch (error) {
      console.error("Error sending Telegram message:", error)
    }
  }

  async sendAlert(title: string, message: string, type: "success" | "error" | "warning" = "success") {
    const emoji = type === "success" ? "✅" : type === "error" ? "❌" : "⚠️"
    const fullMessage = `${emoji} <b>${title}</b>\n\n${message}`
    await this.sendMessage(fullMessage)
  }
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
