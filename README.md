# Crypto Trading Bot

An automated cryptocurrency trading bot for Binance Spot Market with a clean, minimal dashboard and Telegram notifications.

## Features

- 🤖 **Automated Trading**: Smart buy/sell logic based on percentage thresholds
- 💰 **Capital Growth**: Reinvests profits to grow trading capital
- 📊 **Real-time Dashboard**: Clean white/blue themed interface
- 📱 **Telegram Notifications**: Real-time trade alerts and updates
- 📈 **Portfolio Tracking**: Monitor open positions and trade history
- 🔒 **Risk Management**: Configurable trade percentages and thresholds

## Quick Start

1. **Clone and Install**
   \`\`\`bash
   git clone <repository-url>
   cd crypto-trading-bot
   npm install
   \`\`\`

2. **Environment Setup**
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`
   
   Fill in your API keys:
   - Binance API credentials (use testnet for safety)
   - Telegram Bot token and chat ID

3. **Run the Application**
   \`\`\`bash
   npm run dev
   \`\`\`
   
   Open [http://localhost:3000](http://localhost:3000)

## Configuration

### Binance Setup
1. Create a Binance account
2. Generate API keys (enable spot trading)
3. **Important**: Use testnet for initial testing
4. Add keys to `.env.local`

### Telegram Setup
1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot)
3. Add credentials to `.env.local`

## Trading Logic

The bot implements a simple but effective strategy:

- **Buy Signal**: When price drops by configured threshold (e.g., -1%)
- **Sell Signal**: When profit reaches target threshold (e.g., +1.5%)
- **Capital Management**: Uses percentage of total capital per trade
- **Profit Reinvestment**: Automatically grows trading capital

## Dashboard Features

- **Control Panel**: Start/stop bot, configure parameters
- **Portfolio View**: Monitor open positions
- **Trade History**: Complete transaction log
- **Suggestions**: AI-recommended trading pairs
- **Real-time Logs**: System activity monitoring

## Safety Features

- Testnet support for safe testing
- Configurable trade limits
- Real-time monitoring and alerts
- Comprehensive logging
- Emergency stop functionality

## API Endpoints

- `GET /api/bot/balance` - Get current stats
- `POST /api/bot/start` - Start trading bot
- `POST /api/bot/stop` - Stop trading bot
- `GET /api/bot/history` - Get trade history
- `GET /api/bot/portfolio` - Get open positions
- `GET /api/bot/suggestions` - Get recommended coins

## Important Notes

⚠️ **Risk Warning**: Cryptocurrency trading involves significant risk. Start with small amounts and use testnet for learning.

🔒 **Security**: Never share your API keys. Use environment variables and enable IP restrictions on Binance.

📊 **Testing**: Always test thoroughly on testnet before using real funds.

## Support

For issues or questions, please check the documentation or create an issue in the repository.

## License

MIT License - see LICENSE file for details.
