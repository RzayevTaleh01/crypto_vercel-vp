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
