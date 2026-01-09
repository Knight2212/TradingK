import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TradingViewChart from './TradingViewChart';

import { useMarketData } from '../hooks/useMarketData';

// ... (previous imports)
import {
    TrendingUp, TrendingDown, Brain, Zap, Target, Shield,
    Activity, DollarSign, AlertCircle, CheckCircle, Clock,
    BarChart3, Bell, BellRing, Settings, X, Plus,
    Play, Pause, RefreshCw, Layers, Calculator, Gauge,
    ArrowUpCircle, ArrowDownCircle, MinusCircle, History,
    Eye, XCircle, CheckCircle2, Wallet, TrendingUp as Profit
} from 'lucide-react';
import {
    detectCandlestickPatterns,
    findSupportResistance,
    detectTrend,
    calculatePositionSize,
    calculateRiskReward,
    calculateMomentum,
    analyzeVolume,
    calculate20MA,
    detectConsolidation,
    generateSignal
} from '../utils/tradingStrategies';

const ForexTradingApp = () => {
    const [activeTab, setActiveTab] = useState('chart');
    const [activeStrategy, setActiveStrategy] = useState('priceAction');
    const [selectedPair, setSelectedPair] = useState('EUR/USD');
    const [chartData, setChartData] = useState([]);
    const [livePrice, setLivePrice] = useState(1.0410);
    const [priceChange, setPriceChange] = useState(0);
    const [isLive, setIsLive] = useState(true);
    const [pairCategory, setPairCategory] = useState('Major Forex');
    const [selectedInterval, setSelectedInterval] = useState('1m');

    const timeframes = [
        { label: '1m', value: '1m' },
        { label: '5m', value: '5m' },
        { label: '15m', value: '15m' },
        { label: '1h', value: '1h' },
        { label: '4h', value: '4h' },
        { label: '1D', value: '1d' }
    ];

    // Analysis States
    const [currentSignal, setCurrentSignal] = useState(null);
    const [analysisData, setAnalysisData] = useState(null);
    const [autoSignals, setAutoSignals] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Risk Management
    const [accountBalance, setAccountBalance] = useState(10000);
    const [riskPercent, setRiskPercent] = useState(1);

    // Alerts
    const [alerts, setAlerts] = useState([]);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showRiskCalc, setShowRiskCalc] = useState(false);

    // Active Trades & History
    const [activeTrades, setActiveTrades] = useState([]);
    const [tradeHistory, setTradeHistory] = useState([]);

    // All trading pairs
    const allPairs = {
        'Major Forex': [
            { name: 'EUR/USD', price: 1.1700 },
            { name: 'GBP/USD', price: 1.2634 }, // Looks close to search result
            { name: 'USD/JPY', price: 156.45 }, // JPY roughly 0.0064 -> 1/0.0064 = 156.25
            { name: 'USD/CHF', price: 0.8892 },
            { name: 'AUD/USD', price: 0.6423 },
            { name: 'USD/CAD', price: 1.4150 },
            { name: 'NZD/USD', price: 0.5789 }
        ],
        'Minor Forex': [
            { name: 'EUR/GBP', price: 0.8240 },
            { name: 'EUR/JPY', price: 162.80 },
            { name: 'GBP/JPY', price: 197.50 },
            { name: 'EUR/CHF', price: 0.9250 },
            { name: 'EUR/AUD', price: 1.6210 },
            { name: 'GBP/AUD', price: 1.9672 },
            { name: 'AUD/JPY', price: 100.45 }
        ],
        'Commodities': [
            { name: 'XAU/USD', price: 2650.00 },  // Gold
            { name: 'XAG/USD', price: 30.80 },    // Silver
            { name: 'USO/IL', price: 73.50 },     // WTI Crude Oil
            { name: 'UKO/IL', price: 77.20 },     // Brent Crude Oil
            { name: 'NGA/S', price: 3.25 }        // Natural Gas
        ]
    };

    const pairs = allPairs[pairCategory] || allPairs['Major Forex'];

    // Strategies - Rayner Teo's 4 Price Action Strategies
    const strategies = {
        priceAction: {
            name: "Price Action",
            description: "Trade S/R levels with candlestick confirmation",
            color: "from-purple-500 to-pink-600",
            icon: BarChart3,
            tools: ["S/R Zones", "Candlestick Patterns", "Trend Structure", "Key Levels"]
        },
        falseBreak: {
            name: "False Break",
            description: "Reversal strategy - trap breakout traders at key levels",
            color: "from-red-500 to-orange-600",
            icon: Target,
            tools: ["S/R Zones", "Breakout Detection", "Reversal Patterns", "Trap Identification"]
        },
        bwab: {
            name: "Breakout with Build-up",
            description: "Catch explosive moves after consolidation at S/R",
            color: "from-blue-500 to-indigo-600",
            icon: Zap,
            tools: ["Consolidation Finder", "Build-up Detection", "Breakout Trigger", "Momentum Confirm"]
        },
        firstPullback: {
            name: "First Pullback",
            description: "Enter trends on first retracement to moving average",
            color: "from-emerald-500 to-teal-600",
            icon: Activity,
            tools: ["Trend Detection", "20 MA", "Pullback Finder", "Rejection Candles"]
        }
    };

    // Map pair name to TradingView symbol for the Chart
    const getTradingViewSymbol = (pairName) => {
        // Commodity mappings for TradingView
        const commodityMap = {
            'XAU/USD': 'OANDA:XAUUSD', // Gold
            'XAG/USD': 'OANDA:XAGUSD', // Silver
            'USO/IL': 'TVC:USOIL',     // WTI Crude Oil
            'UKO/IL': 'TVC:UKOIL',     // Brent Crude Oil
            'NGA/S': 'NYMEX:NG1!'      // Natural Gas
        };

        // Check if it's a commodity
        if (commodityMap[pairName]) {
            return commodityMap[pairName];
        }

        // For forex pairs
        const cleanSymbol = pairName.replace('/', '').toUpperCase();
        return `FX:${cleanSymbol}`; // e.g. FX:EURUSD
    };

    // Map pair name to FMP symbol
    const getMarketSymbol = (pairName) => {
        // FMP uses clean symbols like EURUSD, BTCUSD
        return pairName.replace('/', '').toUpperCase();
    };

    const marketSymbol = getMarketSymbol(selectedPair);
    const initialPrice = useMemo(() => {
        return Object.values(allPairs).flat().find(p => p.name === selectedPair)?.price || 10000;
    }, [selectedPair, allPairs]);

    const { currentPrice, candleData, isLoading, isLive: isMarketLive, indicators: tvIndicators } = useMarketData(marketSymbol, selectedInterval, initialPrice);

    // Update state from WebSocket data
    useEffect(() => {
        if (candleData.length > 0) {
            setChartData(candleData);
            setLivePrice(currentPrice);

            // Calculate price change (comparing to previous close)
            if (candleData.length >= 2) {
                const prevClose = candleData[candleData.length - 2].close;
                setPriceChange(currentPrice - prevClose);
            }
        } else if (!isLoading) {
            // If not loading and no data, we might be in a stuck state. 
            // The hook simulation should handle this, but let's ensure livePrice is at least set
            setLivePrice(currentPrice);
        }
    }, [candleData, currentPrice, isLoading]);

    // Cleanup analysis data when pair or interval changes
    useEffect(() => {
        setCurrentSignal(null);
        setAnalysisData(null);
        setChartData([]); // Clear data so chart resets immediately
    }, [selectedPair, selectedInterval]);

    // Live price updates - Handled by WebSocket now

    // Run analysis
    const runAnalysis = useCallback(() => {
        setIsAnalyzing(true);

        setTimeout(() => {
            const signal = generateSignal(chartData, currentPrice, activeStrategy, tvIndicators);
            setCurrentSignal(signal);
            setAnalysisData({
                patterns: detectCandlestickPatterns(chartData),
                srLevels: findSupportResistance(chartData),
                trend: { trend: signal.trend.trend, strength: signal.trend.strength },
                momentum: { rsi: signal.momentum.rsi, momentum: signal.momentum.momentum, strength: signal.momentum.strength },
                volume: signal.volume,
                ma20: signal.ma20,
                consolidation: signal.consolidation,
                recommendation: tvIndicators?.recommendation || 'NEUTRAL'
            });

            // Add to auto signals if valid
            if (signal.signal !== 'WAIT' && signal.confidence >= 70) {
                setAutoSignals(prev => [{
                    id: Date.now(),
                    pair: selectedPair,
                    ...signal,
                    time: new Date().toLocaleTimeString(),
                    strategy: strategies[activeStrategy].name
                }, ...prev.slice(0, 19)]);
            }

            setIsAnalyzing(false);
        }, 800);
    }, [chartData, livePrice, activeStrategy, selectedPair]);

    // Auto-analyze every 30 seconds
    useEffect(() => {
        if (!isLive) return;
        const interval = setInterval(runAnalysis, 30000);
        return () => clearInterval(interval);
    }, [isLive, runAnalysis]);

    // Position size calculation
    const positionCalc = useMemo(() => {
        if (!currentSignal?.stopLoss) return null;
        return calculatePositionSize(
            accountBalance,
            riskPercent,
            livePrice,
            parseFloat(currentSignal.stopLoss)
        );
    }, [accountBalance, riskPercent, livePrice, currentSignal]);

    const currentStrategy = strategies[activeStrategy];
    const StrategyIcon = currentStrategy.icon;

    const formatPrice = (price) => {
        if (!price) return '0.0000';
        const num = typeof price === 'string' ? parseFloat(price) : price;

        // Commodities & Special Cases
        if (selectedPair === 'XAU/USD') return num.toFixed(2); // Gold
        if (selectedPair === 'XAG/USD') return num.toFixed(3); // Silver
        if (selectedPair === 'USO/IL' || selectedPair === 'UKO/IL') return num.toFixed(2); // Oil
        if (selectedPair === 'NGA/S') return num.toFixed(3); // Nat Gas

        // Forex
        if (selectedPair.includes('JPY')) {
            return num.toFixed(3);
        }
        return num.toFixed(5);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-2xl p-6 shadow-2xl">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-bold mb-1">📈 TradingK Pro</h1>
                            <p className="text-white/80">Advanced Trading Analysis Platform</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsLive(!isLive)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${isLive ? 'bg-green-500/30 text-green-300' : 'bg-slate-700/50 text-slate-400'
                                    }`}
                            >
                                {isLive ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                                <span className="font-medium">{isLive ? 'LIVE' : 'PAUSED'}</span>
                            </button>

                            <button
                                onClick={() => setShowRiskCalc(true)}
                                className="bg-white/20 rounded-xl p-3 hover:bg-white/30 transition-all"
                                title="Position Calculator"
                            >
                                <Calculator className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => setShowAlertModal(true)}
                                className="bg-white/20 rounded-xl p-3 hover:bg-white/30 transition-all relative"
                            >
                                <BellRing className="w-5 h-5" />
                                {alerts.filter(a => a.triggered).length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 w-5 h-5 rounded-full text-xs flex items-center justify-center">
                                        {alerts.filter(a => a.triggered).length}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setShowSettingsModal(true)}
                                className="bg-white/20 rounded-xl p-3 hover:bg-white/30 transition-all"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Tab Navigation */}
                <nav className="flex gap-2 bg-slate-800/50 rounded-xl p-2 overflow-x-auto">
                    {[
                        { id: 'chart', label: '📊 Analysis', icon: BarChart3 },
                        { id: 'signals', label: '🔔 Signals', icon: Zap },
                        { id: 'trades', label: '📈 Active', icon: Eye, count: activeTrades.length },
                        { id: 'history', label: '📜 History', icon: History },
                        { id: 'tools', label: '🛠️ Tools', icon: Calculator }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === tab.id
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
                                : 'hover:bg-slate-700/50'
                                }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className="bg-green-500 text-xs w-5 h-5 rounded-full flex items-center justify-center">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Analysis Tab */}
                {activeTab === 'chart' && (
                    <>
                        {/* Strategy Selector */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {Object.entries(strategies).map(([key, strategy]) => {
                                const Icon = strategy.icon;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setActiveStrategy(key)}
                                        className={`p-5 rounded-xl transition-all duration-300 text-left ${activeStrategy === key
                                            ? `bg-gradient-to-br ${strategy.color} shadow-xl scale-[1.02]`
                                            : 'bg-slate-800/50 hover:bg-slate-700/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <Icon className="w-6 h-6" />
                                            <h3 className="font-bold text-lg">{strategy.name}</h3>
                                        </div>
                                        <p className="text-sm opacity-75 mb-3">{strategy.description}</p>
                                        {activeStrategy === key && (
                                            <div className="flex flex-wrap gap-2">
                                                {strategy.tools.map((tool, i) => (
                                                    <span key={i} className="bg-white/20 px-2 py-1 rounded text-xs">
                                                        {tool}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Main Trading Interface */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Chart Section */}
                            <div className="lg:col-span-2 space-y-4">

                                {/* Price Display */}
                                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                                    <div className="mb-4">
                                        <select
                                            value={selectedPair}
                                            onChange={(e) => setSelectedPair(e.target.value)}
                                            className="w-full bg-slate-700 rounded-lg px-4 py-3 font-bold text-lg border border-slate-600 hover:bg-slate-600 transition-colors"
                                        >
                                            {Object.entries(allPairs).map(([cat, catPairs]) => (
                                                <optgroup key={cat} label={cat}>
                                                    {catPairs.map(p => (
                                                        <option key={p.name} value={p.name}>{p.name}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Timeframe Selector */}
                                    <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg mb-4">
                                        {timeframes.map(tf => (
                                            <button
                                                key={tf.value}
                                                onClick={() => setSelectedInterval(tf.value)}
                                                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${selectedInterval === tf.value
                                                    ? 'bg-indigo-600 text-white shadow-lg'
                                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                                    }`}
                                            >
                                                {tf.label}
                                            </button>
                                        ))}
                                    </div>


                                    <div className="h-[500px] w-full mb-6 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                                        <TradingViewChart
                                            key={selectedPair}
                                            symbol={getTradingViewSymbol(selectedPair)}
                                            interval={selectedInterval.replace('m', '').replace('h', '').replace('d', 'D')}
                                        />
                                    </div>
                                </div>

                                {/* Analysis Button & Results */}
                                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                                    <button
                                        onClick={runAnalysis}
                                        disabled={isAnalyzing}
                                        className={`w-full bg-gradient-to-r ${currentStrategy.color} rounded-xl p-4 font-bold text-lg transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-3`}
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <RefreshCw className="w-6 h-6 animate-spin" />
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <Brain className="w-6 h-6" />
                                                Run {currentStrategy.name} Analysis
                                            </>
                                        )}
                                    </button>

                                    {currentSignal && (
                                        <div className="mt-6 animate-in fade-in">
                                            <div className={`rounded-xl p-6 ${currentSignal.signal === 'BUY' ? 'bg-green-500/20 border-2 border-green-500' :
                                                currentSignal.signal === 'SELL' ? 'bg-red-500/20 border-2 border-red-500' :
                                                    'bg-yellow-500/20 border-2 border-yellow-500'
                                                }`}>
                                                {/* Signal Header */}
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        {currentSignal.signal === 'BUY' && <ArrowUpCircle className="w-10 h-10 text-green-400" />}
                                                        {currentSignal.signal === 'SELL' && <ArrowDownCircle className="w-10 h-10 text-red-400" />}
                                                        {currentSignal.signal === 'WAIT' && <MinusCircle className="w-10 h-10 text-yellow-400" />}
                                                        <div>
                                                            <h3 className="text-2xl font-bold">{currentSignal.signal}</h3>
                                                            <p className="text-sm opacity-75">Confidence: {currentSignal.confidence}%</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm opacity-75">Risk:Reward</div>
                                                        <div className="text-xl font-bold">{currentSignal.riskReward}</div>
                                                    </div>
                                                </div>

                                                {/* Trade Levels */}
                                                {currentSignal.signal !== 'WAIT' && (
                                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                                        <div className="bg-black/20 rounded-lg p-3 text-center">
                                                            <div className="text-xs opacity-75">Entry</div>
                                                            <div className="font-bold text-lg">{formatPrice(currentSignal.entry)}</div>
                                                        </div>
                                                        <div className="bg-black/20 rounded-lg p-3 text-center">
                                                            <div className="text-xs opacity-75">Stop Loss</div>
                                                            <div className="font-bold text-lg text-red-400">{formatPrice(currentSignal.stopLoss)}</div>
                                                        </div>
                                                        <div className="bg-black/20 rounded-lg p-3 text-center">
                                                            <div className="text-xs opacity-75">Take Profit</div>
                                                            <div className="font-bold text-lg text-green-400">{formatPrice(currentSignal.takeProfit)}</div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Reasons */}
                                                <div className="bg-black/20 rounded-lg p-4">
                                                    <h4 className="font-bold mb-2 flex items-center gap-2">
                                                        <AlertCircle className="w-4 h-4" />
                                                        Analysis Reasons
                                                    </h4>
                                                    {currentSignal.reasons?.length > 0 ? (
                                                        <ul className="text-sm space-y-1">
                                                            {currentSignal.reasons.map((r, i) => (
                                                                <li key={i} className="flex items-center gap-2">
                                                                    <CheckCircle className="w-3 h-3 text-green-400" />
                                                                    {r}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-sm opacity-75">No strong signals detected. Wait for better setup.</p>
                                                    )}
                                                </div>

                                                {/* Position Sizing */}
                                                {positionCalc && currentSignal.signal !== 'WAIT' && (
                                                    <div className="mt-4 grid grid-cols-3 gap-3">
                                                        <div className="bg-black/20 rounded-lg p-3 text-center">
                                                            <div className="text-xs opacity-75">Risk Amount</div>
                                                            <div className="font-bold">${positionCalc.riskAmount}</div>
                                                        </div>
                                                        <div className="bg-black/20 rounded-lg p-3 text-center">
                                                            <div className="text-xs opacity-75">Position Size</div>
                                                            <div className="font-bold">{positionCalc.positionSize} lots</div>
                                                        </div>
                                                        <div className="bg-black/20 rounded-lg p-3 text-center">
                                                            <div className="text-xs opacity-75">Pip Risk</div>
                                                            <div className="font-bold">{positionCalc.pipRisk} pips</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-4">

                                {/* Market Pairs */}
                                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                                    <h3 className="font-bold mb-4 flex items-center gap-2">
                                        <Activity className="w-5 h-5" />
                                        Markets
                                    </h3>

                                    <div className="flex gap-2 mb-3 flex-wrap">
                                        {Object.keys(allPairs).map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setPairCategory(cat)}
                                                className={`px-3 py-1 rounded-lg text-xs ${pairCategory === cat ? 'bg-indigo-600' : 'bg-slate-700/50'
                                                    }`}
                                            >
                                                {cat.replace(' Forex', '').replace(' Crypto', '')}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {pairs.map(pair => (
                                            <button
                                                key={pair.name}
                                                onClick={() => setSelectedPair(pair.name)}
                                                className={`w-full p-3 rounded-lg flex justify-between items-center ${selectedPair === pair.name ? 'bg-indigo-600' : 'bg-slate-700/50 hover:bg-slate-700'
                                                    }`}
                                            >
                                                <span className="font-bold">{pair.name}</span>
                                                {selectedPair === pair.name && <Activity className="w-4 h-4 opacity-75" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Analysis Data */}
                                {analysisData && (
                                    <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                                        <h3 className="font-bold mb-4 flex items-center gap-2">
                                            <Gauge className="w-5 h-5" />
                                            Indicators
                                        </h3>

                                        <div className="space-y-3">
                                            <div className="flex justify-between">
                                                <span className="opacity-75">Trend</span>
                                                <span className={`font-bold ${analysisData.trend.trend === 'bullish' ? 'text-green-400' :
                                                    analysisData.trend.trend === 'bearish' ? 'text-red-400' : ''
                                                    }`}>
                                                    {analysisData.trend.trend.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="opacity-75">RSI</span>
                                                <span className={`font-bold ${parseFloat(analysisData.momentum.rsi) > 70 ? 'text-red-400' :
                                                    parseFloat(analysisData.momentum.rsi) < 30 ? 'text-green-400' : ''
                                                    }`}>
                                                    {analysisData.momentum.rsi}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="opacity-75">Volume</span>
                                                <span className="font-bold">{analysisData.volume.volumeRatio}x avg</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="opacity-75">20 MA</span>
                                                <span className="font-bold">{analysisData.ma20?.toFixed(4) || 'N/A'}</span>
                                            </div>

                                            {analysisData.recommendation && (
                                                <div className={`mt-4 p-3 rounded-xl text-center font-bold shadow-inner ${analysisData.recommendation > 0.5 ? 'bg-green-600/40 text-green-300 border border-green-500/50' :
                                                    analysisData.recommendation > 0.1 ? 'bg-green-500/20 text-green-400' :
                                                        analysisData.recommendation < -0.5 ? 'bg-red-600/40 text-red-300 border border-red-500/50' :
                                                            analysisData.recommendation < -0.1 ? 'bg-red-500/20 text-red-400' :
                                                                'bg-slate-700/50 text-slate-400'
                                                    }`}>
                                                    <div className="text-[10px] opacity-60 mb-1 uppercase tracking-wider">TradingView Rating</div>
                                                    <div className="text-sm">
                                                        {analysisData.recommendation > 0.5 ? 'STRONG BUY' :
                                                            analysisData.recommendation > 0.1 ? 'BUY' :
                                                                analysisData.recommendation < -0.5 ? 'STRONG SELL' :
                                                                    analysisData.recommendation < -0.1 ? 'SELL' : 'NEUTRAL'}
                                                    </div>
                                                </div>
                                            )}
                                            {analysisData.consolidation?.isConsolidating && (
                                                <div className="bg-blue-500/20 rounded-lg p-2 text-center mt-2">
                                                    <span className="text-xs text-blue-300">⚡ Build-up Detected</span>
                                                </div>
                                            )}

                                            {analysisData.patterns.length > 0 && (
                                                <div className="pt-3 border-t border-slate-700">
                                                    <span className="text-xs opacity-75">Patterns:</span>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {analysisData.patterns.map((p, i) => (
                                                            <span key={i} className={`px-2 py-0.5 rounded text-xs ${p.type === 'bullish' ? 'bg-green-500/30 text-green-300' :
                                                                p.type === 'bearish' ? 'bg-red-500/30 text-red-300' :
                                                                    'bg-slate-600'
                                                                }`}>
                                                                {p.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Auto Signals Tab */}
                {activeTab === 'signals' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Zap className="w-6 h-6 text-yellow-400" />
                                Automated Trading Signals
                            </h2>
                            <button
                                onClick={runAnalysis}
                                className="bg-indigo-600 hover:bg-indigo-700 rounded-lg px-4 py-2 flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Scan Now
                            </button>
                        </div>

                        {autoSignals.length === 0 ? (
                            <div className="bg-slate-800/50 rounded-xl p-12 text-center border border-slate-700">
                                <Zap className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <h3 className="text-xl font-bold mb-2">No Signals Yet</h3>
                                <p className="opacity-75 mb-4">Run analysis or wait for auto-scan to detect trading opportunities</p>
                                <button
                                    onClick={runAnalysis}
                                    className="bg-indigo-600 hover:bg-indigo-700 rounded-lg px-6 py-3"
                                >
                                    Start Scanning
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {autoSignals.map(signal => (
                                    <div
                                        key={signal.id}
                                        className={`bg-slate-800/50 rounded-xl p-5 border-l-4 ${signal.signal === 'BUY' ? 'border-green-500' :
                                            signal.signal === 'SELL' ? 'border-red-500' : 'border-yellow-500'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-xl ${signal.signal === 'BUY' ? 'bg-green-500/20' : 'bg-red-500/20'
                                                    }`}>
                                                    {signal.signal === 'BUY' ?
                                                        <ArrowUpCircle className="w-8 h-8 text-green-400" /> :
                                                        <ArrowDownCircle className="w-8 h-8 text-red-400" />
                                                    }
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-xl">{signal.pair}</span>
                                                        <span className={`px-2 py-0.5 rounded text-sm font-bold ${signal.signal === 'BUY' ? 'bg-green-500' : 'bg-red-500'
                                                            }`}>
                                                            {signal.signal}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm opacity-75">{signal.strategy} • {signal.time}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-bold">{signal.confidence}%</div>
                                                <div className="text-sm opacity-75">Confidence</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-3 mt-4">
                                            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                                                <div className="text-xs opacity-75">Entry</div>
                                                <div className="font-bold">{formatPrice(signal.entry)}</div>
                                            </div>
                                            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                                                <div className="text-xs opacity-75">Stop Loss</div>
                                                <div className="font-bold text-red-400">{formatPrice(signal.stopLoss)}</div>
                                            </div>
                                            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                                                <div className="text-xs opacity-75">Take Profit</div>
                                                <div className="font-bold text-green-400">{formatPrice(signal.takeProfit)}</div>
                                            </div>
                                            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                                                <div className="text-xs opacity-75">R:R</div>
                                                <div className="font-bold">{signal.riskReward}</div>
                                            </div>
                                        </div>

                                        {signal.reasons?.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {signal.reasons.map((r, i) => (
                                                    <span key={i} className="bg-slate-700/50 px-3 py-1 rounded-full text-xs">
                                                        {r}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Take Trade Button */}
                                        {!activeTrades.find(t => t.signalId === signal.id) && (
                                            <button
                                                onClick={() => {
                                                    const trade = {
                                                        id: Date.now(),
                                                        signalId: signal.id,
                                                        pair: signal.pair,
                                                        type: signal.signal,
                                                        entry: signal.entry,
                                                        stopLoss: parseFloat(signal.stopLoss),
                                                        takeProfit: parseFloat(signal.takeProfit),
                                                        riskReward: signal.riskReward,
                                                        strategy: signal.strategy,
                                                        confidence: signal.confidence,
                                                        openTime: new Date().toISOString(),
                                                        status: 'open',
                                                        currentPrice: signal.entry,
                                                        pnl: 0,
                                                        pnlPercent: 0
                                                    };
                                                    setActiveTrades(prev => [trade, ...prev]);
                                                }}
                                                className="mt-4 w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl py-3 font-bold flex items-center justify-center gap-2 transition-all"
                                            >
                                                <Plus className="w-5 h-5" />
                                                Take This Trade
                                            </button>
                                        )}
                                        {activeTrades.find(t => t.signalId === signal.id) && (
                                            <div className="mt-4 w-full bg-slate-700/50 rounded-xl py-3 text-center text-sm opacity-75">
                                                ✓ Trade Active - Monitoring
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Active Trades Tab */}
                {activeTab === 'trades' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Eye className="w-6 h-6 text-green-400" />
                                Active Trades ({activeTrades.length})
                            </h2>
                        </div>

                        {activeTrades.length === 0 ? (
                            <div className="bg-slate-800/50 rounded-xl p-12 text-center border border-slate-700">
                                <Eye className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <h3 className="text-xl font-bold mb-2">No Active Trades</h3>
                                <p className="opacity-75">Take a trade from the Signals tab to start monitoring</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {activeTrades.map(trade => {
                                    // Calculate P/L based on current price simulation
                                    const currentPrice = Object.values(allPairs).flat().find(p => p.name === trade.pair)?.price || trade.entry;
                                    const priceDiff = trade.type === 'BUY'
                                        ? currentPrice - trade.entry
                                        : trade.entry - currentPrice;
                                    const pnlPercent = (priceDiff / trade.entry) * 100;
                                    const isProfit = pnlPercent > 0;

                                    // Check if SL or TP hit
                                    const hitSL = trade.type === 'BUY'
                                        ? currentPrice <= trade.stopLoss
                                        : currentPrice >= trade.stopLoss;
                                    const hitTP = trade.type === 'BUY'
                                        ? currentPrice >= trade.takeProfit
                                        : currentPrice <= trade.takeProfit;

                                    return (
                                        <div
                                            key={trade.id}
                                            className={`bg-slate-800/50 rounded-xl p-5 border-2 ${isProfit ? 'border-green-500/50' : 'border-red-500/50'}`}
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl ${trade.type === 'BUY' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                                        {trade.type === 'BUY' ?
                                                            <ArrowUpCircle className="w-8 h-8 text-green-400" /> :
                                                            <ArrowDownCircle className="w-8 h-8 text-red-400" />
                                                        }
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-xl">{trade.pair}</span>
                                                            <span className={`px-2 py-0.5 rounded text-sm font-bold ${trade.type === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}>
                                                                {trade.type}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm opacity-75">{trade.strategy}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`text-2xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                                        {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                                                    </div>
                                                    <div className="text-sm opacity-75">P/L</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-3 mb-4">
                                                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                                                    <div className="text-xs opacity-75">Entry</div>
                                                    <div className="font-bold">{formatPrice(trade.entry)}</div>
                                                </div>
                                                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                                                    <div className="text-xs opacity-75">Current</div>
                                                    <div className={`font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                                        {formatPrice(currentPrice)}
                                                    </div>
                                                </div>
                                                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                                                    <div className="text-xs opacity-75">SL</div>
                                                    <div className="font-bold text-red-400">{formatPrice(trade.stopLoss)}</div>
                                                </div>
                                                <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                                                    <div className="text-xs opacity-75">TP</div>
                                                    <div className="font-bold text-green-400">{formatPrice(trade.takeProfit)}</div>
                                                </div>
                                            </div>

                                            {/* Close Trade Buttons */}
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => {
                                                        const closedTrade = {
                                                            ...trade,
                                                            closeTime: new Date().toISOString(),
                                                            closePrice: currentPrice,
                                                            pnlPercent: pnlPercent,
                                                            result: isProfit ? 'win' : 'loss',
                                                            status: 'closed'
                                                        };
                                                        setTradeHistory(prev => [closedTrade, ...prev]);
                                                        setActiveTrades(prev => prev.filter(t => t.id !== trade.id));
                                                    }}
                                                    className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg py-2 flex items-center justify-center gap-2 transition-all"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    Close Trade
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const wonTrade = {
                                                            ...trade,
                                                            closeTime: new Date().toISOString(),
                                                            closePrice: trade.takeProfit,
                                                            pnlPercent: parseFloat(trade.riskReward.split(':')[1]) || 2,
                                                            result: 'win',
                                                            status: 'closed'
                                                        };
                                                        setTradeHistory(prev => [wonTrade, ...prev]);
                                                        setActiveTrades(prev => prev.filter(t => t.id !== trade.id));
                                                    }}
                                                    className="flex-1 bg-green-600 hover:bg-green-700 rounded-lg py-2 flex items-center justify-center gap-2 transition-all"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Mark Won
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const lostTrade = {
                                                            ...trade,
                                                            closeTime: new Date().toISOString(),
                                                            closePrice: trade.stopLoss,
                                                            pnlPercent: -1,
                                                            result: 'loss',
                                                            status: 'closed'
                                                        };
                                                        setTradeHistory(prev => [lostTrade, ...prev]);
                                                        setActiveTrades(prev => prev.filter(t => t.id !== trade.id));
                                                    }}
                                                    className="flex-1 bg-red-600 hover:bg-red-700 rounded-lg py-2 flex items-center justify-center gap-2 transition-all"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    Mark Lost
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Trade History Tab */}
                {activeTab === 'history' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <History className="w-6 h-6 text-purple-400" />
                                Trade History ({tradeHistory.length})
                            </h2>
                            {tradeHistory.length > 0 && (
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-green-400">
                                        ✓ {tradeHistory.filter(t => t.result === 'win').length} Wins
                                    </span>
                                    <span className="text-red-400">
                                        ✗ {tradeHistory.filter(t => t.result === 'loss').length} Losses
                                    </span>
                                    <span className="font-bold">
                                        {((tradeHistory.filter(t => t.result === 'win').length / tradeHistory.length) * 100).toFixed(0)}% Win Rate
                                    </span>
                                </div>
                            )}
                        </div>

                        {tradeHistory.length === 0 ? (
                            <div className="bg-slate-800/50 rounded-xl p-12 text-center border border-slate-700">
                                <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <h3 className="text-xl font-bold mb-2">No Trade History</h3>
                                <p className="opacity-75">Closed trades will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Stats Summary */}
                                <div className="grid grid-cols-4 gap-4 mb-4">
                                    <div className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700">
                                        <div className="text-sm opacity-75">Total Trades</div>
                                        <div className="text-2xl font-bold">{tradeHistory.length}</div>
                                    </div>
                                    <div className="bg-green-500/20 rounded-xl p-4 text-center border border-green-500/30">
                                        <div className="text-sm opacity-75">Wins</div>
                                        <div className="text-2xl font-bold text-green-400">
                                            {tradeHistory.filter(t => t.result === 'win').length}
                                        </div>
                                    </div>
                                    <div className="bg-red-500/20 rounded-xl p-4 text-center border border-red-500/30">
                                        <div className="text-sm opacity-75">Losses</div>
                                        <div className="text-2xl font-bold text-red-400">
                                            {tradeHistory.filter(t => t.result === 'loss').length}
                                        </div>
                                    </div>
                                    <div className="bg-indigo-500/20 rounded-xl p-4 text-center border border-indigo-500/30">
                                        <div className="text-sm opacity-75">Win Rate</div>
                                        <div className="text-2xl font-bold text-indigo-400">
                                            {((tradeHistory.filter(t => t.result === 'win').length / tradeHistory.length) * 100).toFixed(0)}%
                                        </div>
                                    </div>
                                </div>

                                {/* Trade History List */}
                                {tradeHistory.map(trade => (
                                    <div
                                        key={trade.id}
                                        className={`bg-slate-800/50 rounded-xl p-4 flex items-center justify-between border-l-4 ${trade.result === 'win' ? 'border-green-500' : 'border-red-500'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${trade.result === 'win' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                                {trade.result === 'win' ?
                                                    <CheckCircle2 className="w-6 h-6 text-green-400" /> :
                                                    <XCircle className="w-6 h-6 text-red-400" />
                                                }
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">{trade.pair}</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs ${trade.type === 'BUY' ? 'bg-green-500/30' : 'bg-red-500/30'}`}>
                                                        {trade.type}
                                                    </span>
                                                </div>
                                                <p className="text-xs opacity-75">
                                                    {new Date(trade.closeTime).toLocaleDateString()} • {trade.strategy}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-bold ${trade.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                                                {trade.result === 'win' ? '+' : ''}{trade.pnlPercent?.toFixed(2) || 0}%
                                            </div>
                                            <div className="text-xs opacity-75">{trade.riskReward}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tools Tab */}
                {activeTab === 'tools' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Position Size Calculator */}
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Calculator className="w-6 h-6" />
                                Position Size Calculator
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm opacity-75">Account Balance ($)</label>
                                    <input
                                        type="number"
                                        value={accountBalance}
                                        onChange={(e) => setAccountBalance(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-slate-700 rounded-lg px-4 py-3 mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm opacity-75">Risk Per Trade (%)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={riskPercent}
                                        onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-slate-700 rounded-lg px-4 py-3 mt-1"
                                    />
                                </div>

                                <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between">
                                        <span className="opacity-75">Risk Amount:</span>
                                        <span className="font-bold">${(accountBalance * riskPercent / 100).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="opacity-75">Max Loss per Trade:</span>
                                        <span className="font-bold text-red-400">${(accountBalance * riskPercent / 100).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Risk/Reward Calculator */}
                        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Target className="w-6 h-6" />
                                Risk/Reward Calculator
                            </h3>

                            <RiskRewardCalc currentPrice={livePrice} />
                        </div>
                    </div>
                )}

                {/* Risk Calculator Modal */}
                {showRiskCalc && (
                    <Modal onClose={() => setShowRiskCalc(false)} title="Position Calculator">
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm opacity-75">Account Balance ($)</label>
                                <input
                                    type="number"
                                    value={accountBalance}
                                    onChange={(e) => setAccountBalance(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-700 rounded-lg px-4 py-3 mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-sm opacity-75">Risk (%)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={riskPercent}
                                    onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-700 rounded-lg px-4 py-3 mt-1"
                                />
                            </div>
                            <div className="bg-indigo-500/20 rounded-lg p-4 text-center">
                                <div className="text-sm opacity-75">You risk</div>
                                <div className="text-3xl font-bold">${(accountBalance * riskPercent / 100).toFixed(2)}</div>
                                <div className="text-sm opacity-75">per trade</div>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* Settings Modal */}
                {showSettingsModal && (
                    <Modal onClose={() => setShowSettingsModal(false)} title="Settings">
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm opacity-75">Default Strategy</label>
                                <select
                                    value={activeStrategy}
                                    onChange={(e) => setActiveStrategy(e.target.value)}
                                    className="w-full bg-slate-700 rounded-lg px-4 py-3 mt-1"
                                >
                                    {Object.entries(strategies).map(([k, s]) => (
                                        <option key={k} value={k}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm opacity-75">Account Balance ($)</label>
                                <input
                                    type="number"
                                    value={accountBalance}
                                    onChange={(e) => setAccountBalance(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-700 rounded-lg px-4 py-3 mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-sm opacity-75">Default Risk (%)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={riskPercent}
                                    onChange={(e) => setRiskPercent(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-700 rounded-lg px-4 py-3 mt-1"
                                />
                            </div>
                        </div>
                    </Modal>
                )}

                {/* Alert Modal */}
                {showAlertModal && (
                    <Modal onClose={() => setShowAlertModal(false)} title="Price Alerts">
                        <AlertManager
                            alerts={alerts}
                            setAlerts={setAlerts}
                            pairs={Object.values(allPairs).flat()}
                            currentPair={selectedPair}
                        />
                    </Modal>
                )}

                {/* Footer */}
                <footer className="text-center py-4 text-slate-500 text-sm">
                    <p>TradingK Pro © 2026 • Advanced Trading Analysis</p>
                </footer>
            </div>
        </div>
    );
};

// Modal Component
const Modal = ({ children, onClose, title }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 animate-in fade-in zoom-in">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{title}</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white">
                    <X className="w-6 h-6" />
                </button>
            </div>
            {children}
        </div>
    </div>
);

// Risk/Reward Calculator Component
const RiskRewardCalc = ({ currentPrice }) => {
    const [entry, setEntry] = useState(currentPrice);
    const [sl, setSl] = useState(currentPrice * 0.99);
    const [tp, setTp] = useState(currentPrice * 1.02);

    const rr = calculateRiskReward(entry, sl, tp);

    return (
        <div className="space-y-4">
            <div>
                <label className="text-sm opacity-75">Entry Price</label>
                <input
                    type="number"
                    step="0.0001"
                    value={entry}
                    onChange={(e) => setEntry(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-700 rounded-lg px-4 py-3 mt-1"
                />
            </div>
            <div>
                <label className="text-sm opacity-75">Stop Loss</label>
                <input
                    type="number"
                    step="0.0001"
                    value={sl}
                    onChange={(e) => setSl(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-700 rounded-lg px-4 py-3 mt-1"
                />
            </div>
            <div>
                <label className="text-sm opacity-75">Take Profit</label>
                <input
                    type="number"
                    step="0.0001"
                    value={tp}
                    onChange={(e) => setTp(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-700 rounded-lg px-4 py-3 mt-1"
                />
            </div>

            <div className={`rounded-lg p-4 text-center ${parseFloat(rr.ratio) >= 2 ? 'bg-green-500/20' :
                parseFloat(rr.ratio) >= 1 ? 'bg-yellow-500/20' : 'bg-red-500/20'
                }`}>
                <div className="text-sm opacity-75">Risk:Reward Ratio</div>
                <div className="text-3xl font-bold">{rr.formatted}</div>
                <div className="text-sm opacity-75 mt-1">
                    {parseFloat(rr.ratio) >= 2 ? '✓ Good trade' :
                        parseFloat(rr.ratio) >= 1 ? '⚠ Acceptable' : '✗ Poor setup'}
                </div>
            </div>
        </div>
    );
};

// Alert Manager Component
const AlertManager = ({ alerts, setAlerts, pairs, currentPair }) => {
    const [newAlert, setNewAlert] = useState({
        pair: currentPair,
        condition: 'above',
        value: ''
    });

    const addAlert = () => {
        if (!newAlert.value) return;
        setAlerts([{
            id: Date.now(),
            ...newAlert,
            triggered: false,
            createdAt: new Date().toLocaleTimeString()
        }, ...alerts]);
        setNewAlert({ pair: currentPair, condition: 'above', value: '' });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <select
                    value={newAlert.pair}
                    onChange={(e) => setNewAlert({ ...newAlert, pair: e.target.value })}
                    className="bg-slate-700 rounded-lg px-3 py-2"
                >
                    {pairs.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                <select
                    value={newAlert.condition}
                    onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value })}
                    className="bg-slate-700 rounded-lg px-3 py-2"
                >
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                </select>
            </div>
            <div className="flex gap-2">
                <input
                    type="number"
                    step="0.0001"
                    placeholder="Price level"
                    value={newAlert.value}
                    onChange={(e) => setNewAlert({ ...newAlert, value: e.target.value })}
                    className="flex-1 bg-slate-700 rounded-lg px-3 py-2"
                />
                <button
                    onClick={addAlert}
                    className="bg-indigo-600 hover:bg-indigo-700 rounded-lg px-4"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
                {alerts.map(a => (
                    <div key={a.id} className={`p-3 rounded-lg flex justify-between ${a.triggered ? 'bg-green-500/20 border border-green-500' : 'bg-slate-700/50'
                        }`}>
                        <div>
                            <span className="font-bold">{a.pair}</span>
                            <span className="text-sm opacity-75"> {a.condition} {a.value}</span>
                        </div>
                        <button onClick={() => setAlerts(alerts.filter(x => x.id !== a.id))}>
                            <X className="w-4 h-4 text-slate-400 hover:text-red-400" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ForexTradingApp;
