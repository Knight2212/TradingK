// Trading Strategy Algorithms - Rayner Teo's Top 3
// False Break, Breakout with Build-up (BWAB), First Pullback

// Support/Resistance Detection
export const findSupportResistance = (candles, sensitivity = 3) => {
    if (!candles || candles.length < 10) return { support: [], resistance: [] };

    const levels = { support: [], resistance: [] };
    const prices = candles.map(c => ({ high: c.high, low: c.low, close: c.close }));

    for (let i = sensitivity; i < prices.length - sensitivity; i++) {
        // Check for swing high (resistance)
        let isSwingHigh = true;
        for (let j = 1; j <= sensitivity; j++) {
            if (prices[i].high <= prices[i - j].high || prices[i].high <= prices[i + j].high) {
                isSwingHigh = false;
                break;
            }
        }
        if (isSwingHigh) {
            levels.resistance.push({ price: prices[i].high, strength: 70 + Math.random() * 20, index: i });
        }

        // Check for swing low (support)
        let isSwingLow = true;
        for (let j = 1; j <= sensitivity; j++) {
            if (prices[i].low >= prices[i - j].low || prices[i].low >= prices[i + j].low) {
                isSwingLow = false;
                break;
            }
        }
        if (isSwingLow) {
            levels.support.push({ price: prices[i].low, strength: 70 + Math.random() * 20, index: i });
        }
    }

    // Cluster nearby levels
    const clusterLevels = (arr, threshold) => {
        if (arr.length === 0) return [];
        const sorted = [...arr].sort((a, b) => a.price - b.price);
        const clustered = [];
        let cluster = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            if ((sorted[i].price - cluster[0].price) / cluster[0].price < threshold) {
                cluster.push(sorted[i]);
            } else {
                const avgPrice = cluster.reduce((s, l) => s + l.price, 0) / cluster.length;
                const maxStrength = Math.max(...cluster.map(l => l.strength));
                clustered.push({ price: avgPrice, strength: Math.min(maxStrength + cluster.length * 5, 99) });
                cluster = [sorted[i]];
            }
        }
        if (cluster.length > 0) {
            const avgPrice = cluster.reduce((s, l) => s + l.price, 0) / cluster.length;
            const maxStrength = Math.max(...cluster.map(l => l.strength));
            clustered.push({ price: avgPrice, strength: Math.min(maxStrength + cluster.length * 5, 99) });
        }
        return clustered.slice(-3);
    };

    return {
        support: clusterLevels(levels.support, 0.005),
        resistance: clusterLevels(levels.resistance, 0.005)
    };
};

// Detect candlestick patterns for reversals
export const detectCandlestickPatterns = (candles) => {
    if (!candles || candles.length < 3) return [];

    const patterns = [];
    const latest = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const bodySize = Math.abs(latest.close - latest.open);
    const totalRange = latest.high - latest.low;
    const lowerWick = Math.min(latest.open, latest.close) - latest.low;
    const upperWick = latest.high - Math.max(latest.open, latest.close);

    // Bullish Engulfing - strong reversal
    if (prev.close < prev.open && latest.close > latest.open &&
        latest.open <= prev.close && latest.close >= prev.open) {
        patterns.push({ name: 'Bullish Engulfing', type: 'bullish', strength: 85 });
    }

    // Bearish Engulfing
    if (prev.close > prev.open && latest.close < latest.open &&
        latest.open >= prev.close && latest.close <= prev.open) {
        patterns.push({ name: 'Bearish Engulfing', type: 'bearish', strength: 85 });
    }

    // Hammer (bullish reversal)
    if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
        patterns.push({ name: 'Hammer', type: 'bullish', strength: 75 });
    }

    // Shooting Star (bearish reversal)
    if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5) {
        patterns.push({ name: 'Shooting Star', type: 'bearish', strength: 75 });
    }

    // Strong rejection candle (long wick)
    if (lowerWick > totalRange * 0.6) {
        patterns.push({ name: 'Bullish Rejection', type: 'bullish', strength: 70 });
    }
    if (upperWick > totalRange * 0.6) {
        patterns.push({ name: 'Bearish Rejection', type: 'bearish', strength: 70 });
    }

    return patterns;
};

// Detect trend using higher highs/lows
export const detectTrend = (candles) => {
    if (!candles || candles.length < 14) return { trend: 'neutral', strength: 50 };

    const recent = candles.slice(-14);
    let higherHighs = 0, higherLows = 0, lowerHighs = 0, lowerLows = 0;

    for (let i = 1; i < recent.length; i++) {
        if (recent[i].high > recent[i - 1].high) higherHighs++;
        else lowerHighs++;
        if (recent[i].low > recent[i - 1].low) higherLows++;
        else lowerLows++;
    }

    const bullishScore = (higherHighs + higherLows) / ((recent.length - 1) * 2);
    const bearishScore = (lowerHighs + lowerLows) / ((recent.length - 1) * 2);

    if (bullishScore > 0.6) return { trend: 'bullish', strength: Math.round(bullishScore * 100) };
    if (bearishScore > 0.6) return { trend: 'bearish', strength: Math.round(bearishScore * 100) };
    return { trend: 'neutral', strength: 50 };
};

// Calculate 20-period Moving Average
export const calculate20MA = (candles) => {
    if (!candles || candles.length < 20) return null;
    const sum = candles.slice(-20).reduce((s, c) => s + c.close, 0);
    return sum / 20;
};

// Detect consolidation (build-up) - low volatility period
export const detectConsolidation = (candles, periods = 10) => {
    if (!candles || candles.length < periods) return { isConsolidating: false };

    const recent = candles.slice(-periods);
    const ranges = recent.map(c => c.high - c.low);
    const avgRange = ranges.reduce((s, r) => s + r, 0) / periods;

    // Check if range is contracting (build-up)
    const firstHalfAvg = ranges.slice(0, 5).reduce((s, r) => s + r, 0) / 5;
    const secondHalfAvg = ranges.slice(-5).reduce((s, r) => s + r, 0) / 5;

    const isContracting = secondHalfAvg < firstHalfAvg * 0.7;

    // Calculate the consolidation zone
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);
    const zoneHigh = Math.max(...highs);
    const zoneLow = Math.min(...lows);

    return {
        isConsolidating: isContracting,
        zoneHigh,
        zoneLow,
        avgRange,
        contraction: firstHalfAvg > 0 ? (1 - secondHalfAvg / firstHalfAvg) * 100 : 0
    };
};

// Detect False Break
export const detectFalseBreak = (candles, srLevels, currentPrice) => {
    if (!candles || candles.length < 5) return null;

    const recent = candles.slice(-5);
    const prev = recent[recent.length - 2];
    const latest = recent[recent.length - 1];

    // Check for false break of resistance (bearish signal)
    for (const res of srLevels.resistance) {
        // Price went above resistance but closed below
        if (prev.high > res.price && latest.close < res.price && latest.close < prev.close) {
            return {
                type: 'SELL',
                level: res.price,
                confidence: 80,
                reason: `False break above resistance ${res.price.toFixed(4)}`
            };
        }
    }

    // Check for false break of support (bullish signal)
    for (const sup of srLevels.support) {
        // Price went below support but closed above
        if (prev.low < sup.price && latest.close > sup.price && latest.close > prev.close) {
            return {
                type: 'BUY',
                level: sup.price,
                confidence: 80,
                reason: `False break below support ${sup.price.toFixed(4)}`
            };
        }
    }

    return null;
};

// Detect Breakout with Build-up (BWAB)
export const detectBWAB = (candles, srLevels) => {
    if (!candles || candles.length < 15) return null;

    const consolidation = detectConsolidation(candles.slice(-15, -1), 10);
    const latest = candles[candles.length - 1];

    if (!consolidation.isConsolidating) return null;

    // Check for breakout of consolidation zone
    // Bullish breakout - closed above zone high
    if (latest.close > consolidation.zoneHigh) {
        const nearResistance = srLevels.resistance.some(r =>
            Math.abs(consolidation.zoneHigh - r.price) / r.price < 0.005
        );

        if (nearResistance) {
            return {
                type: 'BUY',
                zoneHigh: consolidation.zoneHigh,
                zoneLow: consolidation.zoneLow,
                confidence: 85,
                reason: `Breakout with build-up above ${consolidation.zoneHigh.toFixed(4)}`
            };
        }
    }

    // Bearish breakout - closed below zone low
    if (latest.close < consolidation.zoneLow) {
        const nearSupport = srLevels.support.some(s =>
            Math.abs(consolidation.zoneLow - s.price) / s.price < 0.005
        );

        if (nearSupport) {
            return {
                type: 'SELL',
                zoneHigh: consolidation.zoneHigh,
                zoneLow: consolidation.zoneLow,
                confidence: 85,
                reason: `Breakout with build-up below ${consolidation.zoneLow.toFixed(4)}`
            };
        }
    }

    return null;
};

// Detect First Pullback to 20 MA
export const detectFirstPullback = (candles) => {
    if (!candles || candles.length < 25) return null;

    const trend = detectTrend(candles.slice(-20));
    const ma20 = calculate20MA(candles);
    const latest = candles[candles.length - 1];
    const patterns = detectCandlestickPatterns(candles);

    if (!ma20 || trend.trend === 'neutral') return null;

    // Check if price is near 20 MA (within 0.5%)
    const distanceToMA = Math.abs(latest.close - ma20) / ma20;
    const nearMA = distanceToMA < 0.005;

    // Bullish pullback - uptrend, price pulled back to MA
    if (trend.trend === 'bullish' && nearMA && latest.close > ma20) {
        const bullishPattern = patterns.find(p => p.type === 'bullish');
        if (bullishPattern || latest.close > latest.open) {
            return {
                type: 'BUY',
                ma20,
                confidence: 75 + (bullishPattern ? 10 : 0),
                reason: `First pullback to 20 MA in uptrend${bullishPattern ? ` + ${bullishPattern.name}` : ''}`
            };
        }
    }

    // Bearish pullback - downtrend, price pulled back to MA
    if (trend.trend === 'bearish' && nearMA && latest.close < ma20) {
        const bearishPattern = patterns.find(p => p.type === 'bearish');
        if (bearishPattern || latest.close < latest.open) {
            return {
                type: 'SELL',
                ma20,
                confidence: 75 + (bearishPattern ? 10 : 0),
                reason: `First pullback to 20 MA in downtrend${bearishPattern ? ` + ${bearishPattern.name}` : ''}`
            };
        }
    }

    return null;
};

// Position Size Calculator
export const calculatePositionSize = (accountBalance, riskPercent, entryPrice, stopLoss) => {
    const riskAmount = accountBalance * (riskPercent / 100);
    const pipValue = Math.abs(entryPrice - stopLoss);
    const positionSize = riskAmount / pipValue;

    return {
        riskAmount: riskAmount.toFixed(2),
        positionSize: positionSize.toFixed(2),
        pipRisk: (pipValue * 10000).toFixed(1)
    };
};

// Risk/Reward Calculator
export const calculateRiskReward = (entry, stopLoss, takeProfit) => {
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);
    const ratio = reward / risk;

    return {
        risk: risk.toFixed(5),
        reward: reward.toFixed(5),
        ratio: ratio.toFixed(2),
        formatted: `1:${ratio.toFixed(1)}`
    };
};

// Volume Analysis
export const analyzeVolume = (candles) => {
    if (!candles || candles.length < 20) return { trend: 'normal', vwap: 0, volumeRatio: 1 };

    const recent = candles.slice(-20);
    const avgVolume = recent.reduce((s, c) => s + c.volume, 0) / 20;
    const currentVolume = recent[recent.length - 1].volume;
    const volumeRatio = currentVolume / avgVolume;

    // VWAP Calculation
    let sumPV = 0, sumV = 0;
    recent.forEach(c => {
        const typicalPrice = (c.high + c.low + c.close) / 3;
        sumPV += typicalPrice * c.volume;
        sumV += c.volume;
    });
    const vwap = sumPV / sumV;

    let trend = 'normal';
    if (volumeRatio > 1.5) trend = 'high';
    else if (volumeRatio < 0.5) trend = 'low';

    return { trend, vwap: vwap.toFixed(4), volumeRatio: volumeRatio.toFixed(2) };
};

// Momentum (RSI)
export const calculateMomentum = (candles) => {
    if (!candles || candles.length < 14) return { rsi: 50, momentum: 0, strength: 'neutral' };

    const closes = candles.slice(-14).map(c => c.close);

    let gains = 0, losses = 0;
    for (let i = 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    const roc = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;

    let strength = 'neutral';
    if (rsi > 70) strength = 'overbought';
    else if (rsi < 30) strength = 'oversold';
    else if (rsi > 55) strength = 'bullish';
    else if (rsi < 45) strength = 'bearish';

    return { rsi: rsi.toFixed(1), momentum: roc.toFixed(2), strength };
};

// Main Signal Generator
export const generateSignal = (candles, currentPrice, strategy, indicators = null) => {
    const srLevels = findSupportResistance(candles);
    const trend = indicators?.trend ? { trend: indicators.trend, strength: 80 } : detectTrend(candles);
    const patterns = detectCandlestickPatterns(candles);
    const momentum = indicators?.rsi ? { rsi: indicators.rsi, momentum: 0, strength: indicators.rsi > 70 ? 'overbought' : indicators.rsi < 30 ? 'oversold' : 'neutral' } : calculateMomentum(candles);
    const volume = analyzeVolume(candles);
    const ma20 = indicators?.ma20 || calculate20MA(candles);
    const consolidation = detectConsolidation(candles);

    let signal = 'WAIT';
    let confidence = 0;
    let reasons = [];
    let entry = currentPrice;
    let stopLoss, takeProfit;

    // Boost confidence if TradingView recommendation matches
    if (indicators?.recommendation) {
        if (indicators.recommendation.includes('BUY')) {
            confidence += 5;
        } else if (indicators.recommendation.includes('SELL')) {
            confidence += 5;
        }
    }

    // PRICE ACTION Strategy (Basic S/R + Patterns)
    if (strategy === 'priceAction') {
        const nearSupport = srLevels.support.find(s => Math.abs(currentPrice - s.price) / currentPrice < 0.003);
        const nearResistance = srLevels.resistance.find(r => Math.abs(currentPrice - r.price) / currentPrice < 0.003);

        // Bullish Trade: At Support + Bullish Pattern
        if (nearSupport) {
            const bullishPattern = patterns.find(p => p.type === 'bullish');
            if (bullishPattern) {
                signal = 'BUY';
                confidence = 80 + (trend.trend === 'bullish' ? 10 : 0);
                reasons.push(`Bounce off support ${nearSupport.price.toFixed(4)}`);
                reasons.push(`Pattern: ${bullishPattern.name}`);
                if (trend.trend === 'bullish') reasons.push('Confluence with uptrend');

                stopLoss = nearSupport.price * 0.995;
                takeProfit = srLevels.resistance[0]?.price || currentPrice * 1.02;
            } else {
                reasons.push(`At support ${nearSupport.price.toFixed(4)} - waiting for rejection candle`);
            }
        }

        // Bearish Trade: At Resistance + Bearish Pattern
        if (nearResistance) {
            const bearishPattern = patterns.find(p => p.type === 'bearish');
            if (bearishPattern) {
                signal = 'SELL';
                confidence = 80 + (trend.trend === 'bearish' ? 10 : 0);
                reasons.push(`Rejection at resistance ${nearResistance.price.toFixed(4)}`);
                reasons.push(`Pattern: ${bearishPattern.name}`);
                if (trend.trend === 'bearish') reasons.push('Confluence with downtrend');

                stopLoss = nearResistance.price * 1.005;
                takeProfit = srLevels.support[0]?.price || currentPrice * 0.98;
            } else {
                reasons.push(`At resistance ${nearResistance.price.toFixed(4)} - waiting for rejection candle`);
            }
        }
    }

    // FALSE BREAK Strategy
    if (strategy === 'falseBreak') {
        const falseBreak = detectFalseBreak(candles, srLevels, currentPrice);

        if (falseBreak) {
            signal = falseBreak.type;
            confidence = falseBreak.confidence;
            reasons.push(falseBreak.reason);
            reasons.push(`Trend: ${trend.trend}`);

            if (signal === 'BUY') {
                stopLoss = srLevels.support[0]?.price * 0.995 || currentPrice * 0.985;
                takeProfit = srLevels.resistance[0]?.price || currentPrice * 1.02;
            } else {
                stopLoss = srLevels.resistance[0]?.price * 1.005 || currentPrice * 1.015;
                takeProfit = srLevels.support[0]?.price || currentPrice * 0.98;
            }
        }
    }

    // BREAKOUT WITH BUILD-UP (BWAB) Strategy
    if (strategy === 'bwab') {
        const bwab = detectBWAB(candles, srLevels);

        if (bwab) {
            signal = bwab.type;
            confidence = bwab.confidence;
            reasons.push(bwab.reason);
            reasons.push(`Consolidation detected`);

            if (signal === 'BUY') {
                stopLoss = bwab.zoneLow * 0.995;
                takeProfit = currentPrice + (currentPrice - bwab.zoneLow) * 2;
            } else {
                stopLoss = bwab.zoneHigh * 1.005;
                takeProfit = currentPrice - (bwab.zoneHigh - currentPrice) * 2;
            }
        } else if (consolidation.isConsolidating) {
            reasons.push(`Build-up forming (${consolidation.contraction.toFixed(0)}% contraction)`);
            reasons.push('Waiting for breakout...');
        }
    }

    // FIRST PULLBACK Strategy
    if (strategy === 'firstPullback') {
        const pullback = detectFirstPullback(candles);

        if (pullback) {
            signal = pullback.type;
            confidence = pullback.confidence;
            reasons.push(pullback.reason);
            reasons.push(`20 MA: ${pullback.ma20.toFixed(4)}`);

            if (signal === 'BUY') {
                stopLoss = ma20 * 0.99;
                takeProfit = currentPrice + (currentPrice - ma20) * 3;
            } else {
                stopLoss = ma20 * 1.01;
                takeProfit = currentPrice - (ma20 - currentPrice) * 3;
            }
        } else {
            reasons.push(`Trend: ${trend.trend} (${trend.strength}%)`);
            if (ma20) reasons.push(`20 MA: ${ma20.toFixed(4)}`);
        }
    }

    const rr = signal !== 'WAIT' && stopLoss && takeProfit
        ? calculateRiskReward(currentPrice, stopLoss, takeProfit)
        : null;

    return {
        signal,
        confidence: Math.round(confidence),
        entry: currentPrice,
        stopLoss: stopLoss?.toFixed(5),
        takeProfit: takeProfit?.toFixed(5),
        riskReward: rr?.formatted || 'N/A',
        reasons,
        patterns,
        trend,
        momentum,
        volume,
        ma20,
        consolidation,
        support: srLevels.support,
        resistance: srLevels.resistance
    };
};
