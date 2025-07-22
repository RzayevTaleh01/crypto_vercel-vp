# 🚀 Crypto Trading Bot - Sadə Quraşdırma

## ⚡ Tez Quraşdırma (3 dəqiqə)

### 1. Environment Faylı
`.env.local` faylı yaradın:
\`\`\`env
DATABASE_URL=your_neon_database_url
BINANCE_API_KEY=your_testnet_api_key
BINANCE_API_SECRET=your_testnet_secret
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
\`\`\`

### 2. Quraşdırma
\`\`\`bash
# Paketləri yüklə
npm install

# Database qur
npm run db:setup

# Başlat
npm run dev
\`\`\`

### 3. Yoxla
- http://localhost:3000 açın
- Database status "DB Aktiv" olmalıdır
- Bot-u başladın və Telegram-da bildiriş gəlməlidir

## 🎯 Xüsusiyyətlər

- ✅ **Sadə Interface**: Təmiz və anlaşılan dizayn
- ✅ **Real Trading**: Binance testnet ilə real trade-lər
- ✅ **Telegram Bildirişləri**: Bütün trade-lər üçün bildiriş
- ✅ **Database**: Neon PostgreSQL ilə məlumat saxlama
- ✅ **Auto Recovery**: Xəta halında avtomatik bərpa

## 🔧 Problemlər

### Database xətası
\`\`\`bash
npm run db:init
\`\`\`

### Bot başlamır
- API key-ləri yoxlayın
- Telegram token-i yoxlayın
- Database bağlantısını yoxlayın

**Artıq hazırdır! 🎉**
