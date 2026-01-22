// Telegram Alerts Integration
// Receives alerts from Python bot and stores in database

import { Router } from 'express';
import { prisma } from '@polymarket/database';

const router = Router();

interface TelegramAlert {
  type: 'whale' | 'price_move';
  market_title: string;
  market_slug?: string;
  outcome?: string;
  price?: number;
  price_old?: number;
  price_new?: number;
  percent_change?: number;
  duration_sec?: number;
  size_usd?: number;
  wallet?: string;
  direction?: 'UP' | 'DOWN';
  timestamp: number;
}

// Endpoint for Python bot to send alerts
router.post('/webhook', async (req, res) => {
  try {
    const alert: TelegramAlert = req.body;

    // Validate
    if (!alert.type || !alert.market_title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Determine severity
    let severity = 'medium';
    if (alert.type === 'whale' && alert.size_usd && alert.size_usd >= 200000) {
      severity = 'high';
    } else if (alert.type === 'price_move' && alert.percent_change && Math.abs(alert.percent_change) >= 20) {
      severity = 'high';
    } else if (alert.type === 'whale' && alert.size_usd && alert.size_usd < 150000) {
      severity = 'low';
    }

    // Store in database
    const saved = await prisma.telegramAlert.create({
      data: {
        type: alert.type,
        severity,
        marketTitle: alert.market_title,
        marketSlug: alert.market_slug || null,
        outcome: alert.outcome || null,
        priceOld: alert.price_old || null,
        priceNew: alert.price_new || null,
        price: alert.price || null,
        percentChange: alert.percent_change || null,
        durationSec: alert.duration_sec || null,
        direction: alert.direction || null,
        sizeUsd: alert.size_usd || null,
        wallet: alert.wallet || null,
        alertTimestamp: new Date(alert.timestamp * 1000),
      },
    });

    console.log('📡 Alert saved:', {
      id: saved.id,
      type: saved.type,
      severity: saved.severity,
      market: saved.marketTitle,
    });

    res.json({ success: true, alert: saved });
  } catch (error: any) {
    console.error('Telegram alert error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recent alerts (for frontend)
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const type = req.query.type as string | undefined;

    const alerts = await prisma.telegramAlert.findMany({
      where: type && type !== 'all' ? { type } : undefined,
      orderBy: { alertTimestamp: 'desc' },
      take: limit,
    });

    // Format for frontend
    const formatted = alerts.map(a => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      title: a.type === 'whale' ? 'WHALE ALERT' : `PRICE MOVE ${a.direction}`,
      description: formatAlertDescription(a),
      timestamp: a.alertTimestamp,
      icon: a.type === 'whale' ? '🐋' : '📊',
      market_slug: a.marketSlug,
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: error.message });
  }
});

function formatAlertDescription(alert: any): string {
  if (alert.type === 'whale') {
    return `${alert.marketTitle} ${alert.outcome ? `- ${alert.outcome}` : ''} @ ${alert.price?.toFixed(3) || '?'} (≈ $${alert.sizeUsd?.toLocaleString() || '?'}) ${alert.wallet || ''}`;
  } else if (alert.type === 'price_move') {
    return `${alert.marketTitle} ${alert.outcome ? `- ${alert.outcome}` : ''}: ${alert.priceOld?.toFixed(3)} → ${alert.priceNew?.toFixed(3)} (${alert.percentChange >= 0 ? '+' : ''}${alert.percentChange?.toFixed(1)}% in ${alert.durationSec}s)`;
  }
  return alert.marketTitle;
}

export default router;
