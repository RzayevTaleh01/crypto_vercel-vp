-- Create database tables for crypto trading bot

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL,
    type VARCHAR(4) NOT NULL CHECK (type IN ('BUY', 'SELL')),
    amount DECIMAL(18, 8) NOT NULL,
    price DECIMAL(18, 8) NOT NULL,
    quantity DECIMAL(18, 8) NOT NULL,
    profit DECIMAL(18, 8),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(10) NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
    order_id BIGINT,
    fees DECIMAL(18, 8) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot configuration table
CREATE TABLE IF NOT EXISTS bot_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initial_capital DECIMAL(18, 2) NOT NULL,
    trade_percentage DECIMAL(5, 2) NOT NULL,
    buy_threshold DECIMAL(5, 2) NOT NULL,
    sell_threshold DECIMAL(5, 2) NOT NULL,
    telegram_enabled BOOLEAN DEFAULT false,
    max_daily_loss DECIMAL(5, 2) DEFAULT 10,
    max_open_trades INTEGER DEFAULT 5,
    stop_loss_percentage DECIMAL(5, 2) DEFAULT 5,
    trading_pairs TEXT[] DEFAULT ARRAY['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
    use_rsi BOOLEAN DEFAULT true,
    use_macd BOOLEAN DEFAULT true,
    use_sma BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot statistics table
CREATE TABLE IF NOT EXISTS bot_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_capital DECIMAL(18, 2) NOT NULL,
    trading_capital DECIMAL(18, 2) NOT NULL,
    total_profit DECIMAL(18, 2) DEFAULT 0,
    is_running BOOLEAN DEFAULT false,
    trades_count INTEGER DEFAULT 0,
    win_rate DECIMAL(5, 2) DEFAULT 0,
    max_drawdown DECIMAL(5, 2) DEFAULT 0,
    sharpe_ratio DECIMAL(8, 4) DEFAULT 0,
    daily_loss DECIMAL(18, 2) DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('INFO', 'ERROR', 'WARNING', 'DEBUG')),
    message TEXT NOT NULL,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market data table for real-time analysis
CREATE TABLE IF NOT EXISTS market_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL,
    price DECIMAL(18, 8) NOT NULL,
    price_change_percent DECIMAL(8, 4) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    high DECIMAL(18, 8) NOT NULL,
    low DECIMAL(18, 8) NOT NULL,
    open_price DECIMAL(18, 8) NOT NULL,
    bid_price DECIMAL(18, 8),
    ask_price DECIMAL(18, 8),
    rsi DECIMAL(8, 4),
    macd_signal VARCHAR(10),
    sma_signal VARCHAR(10),
    volatility DECIMAL(8, 4),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance tracking table
CREATE TABLE IF NOT EXISTS daily_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    profit DECIMAL(18, 2) NOT NULL,
    total_capital DECIMAL(18, 2) NOT NULL,
    trades_count INTEGER NOT NULL,
    win_rate DECIMAL(5, 2) DEFAULT 0,
    max_drawdown DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price history for technical analysis
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL,
    open_price DECIMAL(18, 8) NOT NULL,
    high_price DECIMAL(18, 8) NOT NULL,
    low_price DECIMAL(18, 8) NOT NULL,
    close_price DECIMAL(18, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    open_time TIMESTAMPTZ NOT NULL,
    close_time TIMESTAMPTZ NOT NULL,
    interval_type VARCHAR(10) NOT NULL DEFAULT '5m',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account balances table
CREATE TABLE IF NOT EXISTS account_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset VARCHAR(10) NOT NULL,
    free DECIMAL(18, 8) NOT NULL,
    locked DECIMAL(18, 8) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol ON price_history(symbol);
CREATE INDEX IF NOT EXISTS idx_price_history_open_time ON price_history(open_time);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_config_updated_at BEFORE UPDATE ON bot_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_stats_updated_at BEFORE UPDATE ON bot_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
