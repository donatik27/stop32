"""
POLYALARM → SPECEHUB API INTEGRATION
=====================================
Add this to your existing polyalarm bot to send alerts to SpaceHub API!

USAGE:
1. Replace tg_send() calls with dual_send()
2. Set SPACEHUB_API_URL to your Railway API
3. Run bot as before!
"""

import time
import requests

# ===== CONFIG =====
SPACEHUB_API_URL = "https://your-railway-api.railway.app/api/telegram-alerts/webhook"
# OR for local testing: "http://localhost:3001/api/telegram-alerts/webhook"

TG_BOT_TOKEN = "YOUR_BOT_TOKEN"
TG_CHAT_ID = "YOUR_CHAT_ID"


# ===== DUAL SEND =====
def dual_send(text, alert_data=None):
    """
    Send alert to BOTH Telegram and SpaceHub API!
    
    Args:
        text: Formatted message for Telegram
        alert_data: Structured data for API (optional)
    """
    # 1. Send to Telegram (original behavior)
    tg_send(text)
    
    # 2. Send to SpaceHub API (NEW!)
    if alert_data:
        api_send(alert_data)


def tg_send(text):
    """Original Telegram send function"""
    url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TG_CHAT_ID,
        "text": text,
        "disable_web_page_preview": True,
    }
    try:
        r = requests.post(url, json=payload, timeout=15)
        if r.status_code != 200:
            print("TG send error:", r.status_code, r.text)
    except Exception as e:
        print("TG send exception:", e)


def api_send(alert_data):
    """Send structured alert to SpaceHub API"""
    try:
        r = requests.post(
            SPACEHUB_API_URL,
            json=alert_data,
            timeout=10,
            headers={"Content-Type": "application/json"}
        )
        if r.status_code != 200:
            print(f"API send error: {r.status_code} {r.text}")
    except Exception as e:
        print(f"API send exception: {e}")


# ===== HELPER FUNCTIONS =====
def create_whale_alert(title, slug, outcome, price, size_usd, wallet):
    """Create structured whale alert"""
    return {
        "type": "whale",
        "market_title": title,
        "market_slug": slug,
        "outcome": outcome,
        "price": price,
        "size_usd": size_usd,
        "wallet": wallet,
        "timestamp": int(time.time())
    }


def create_price_move_alert(title, slug, outcome, old_price, new_price, duration_sec, direction):
    """Create structured price move alert"""
    pct_change = ((new_price - old_price) / old_price) * 100 if old_price > 0 else 0
    return {
        "type": "price_move",
        "market_title": title,
        "market_slug": slug,
        "outcome": outcome,
        "price_old": old_price,
        "price_new": new_price,
        "percent_change": pct_change,
        "duration_sec": duration_sec,
        "direction": direction,
        "timestamp": int(time.time())
    }


# ===== MODIFIED HANDLERS =====
def handle_trade_for_whale_MODIFIED(tr, meta_by_condition):
    """
    Modified version of handle_trade_for_whale() that sends to both Telegram and API
    
    REPLACE your existing handle_trade_for_whale() with this!
    """
    info = market_info(tr, meta_by_condition)
    if not info:
        return
    condition_id, title, slug, outcome_name, _ = info
    
    tx = tr.get("transactionHash") or ""
    if tx:
        if tx in seen_tx_whales:
            return
        seen_tx_whales.add(tx)
    
    ts = parse_ts(tr.get("timestamp"))
    cd = whale_cooldown_until.get(condition_id, 0.0)
    if ts < cd:
        return
    
    price = parse_float(tr.get("price"))
    try:
        size = float(tr.get("size"))
    except Exception:
        size = None
    
    wallet = tr.get("proxyWallet", "")
    wallet_short = (wallet[:6] + "…" + wallet[-4:]) if wallet and len(wallet) > 12 else wallet
    
    approx_usd = None
    if size is not None and math.isfinite(price):
        approx_usd = size * price
    
    # Telegram message (original format)
    msg = format_block(
        "🐳",
        "WHALE TRADE",
        [
            f"Market: {title}",
            f"Outcome: {outcome_name} @ {price:.3f}",
            f"Size: >= ${WHALE_USD:,}" + (f" (≈ ${approx_usd:,.0f})" if approx_usd else ""),
            f"Trader: {wallet_short}",
            f"Link: {market_link(slug)}",
        ],
    )
    
    # API data (structured)
    alert_data = create_whale_alert(
        title=title,
        slug=slug,
        outcome=outcome_name,
        price=price,
        size_usd=approx_usd if approx_usd else WHALE_USD,
        wallet=wallet_short
    )
    
    # DUAL SEND! 🚀
    dual_send(msg, alert_data)
    
    whale_cooldown_until[condition_id] = ts + WHALE_COOLDOWN_SEC


def handle_trade_for_squeeze_MODIFIED(tr, meta_by_condition):
    """
    Modified version of handle_trade_for_squeeze() that sends to both Telegram and API
    
    REPLACE your existing handle_trade_for_squeeze() with this!
    """
    info = market_info(tr, meta_by_condition)
    if not info:
        return
    condition_id, title, slug, outcome_name, outcome_idx = info
    
    price = parse_float(tr.get("price"))
    ts = parse_ts(tr.get("timestamp"))
    if not math.isfinite(price) or price <= 0:
        return
    
    key = (condition_id, outcome_idx)
    dq = price_points[key]
    dq.append((ts, price))
    
    cutoff = ts - SQUEEZE_WINDOW_SEC
    while dq and dq[0][0] < cutoff:
        dq.popleft()
    
    if len(dq) < 2:
        return
    
    cd = squeeze_cooldown_until.get(key, 0.0)
    if ts < cd:
        return
    
    old_ts, old_price = dq[0]
    new_ts, new_price = dq[-1]
    if old_price <= 0:
        return
    
    pct = (new_price - old_price) / old_price
    if abs(pct) >= SQUEEZE_PCT:
        direction = "UP" if pct > 0 else "DOWN"
        duration = int(new_ts - old_ts)
        
        # Telegram message (original format)
        msg = format_block(
            "📊",
            f"PRICE MOVE {direction}",
            [
                f"Market: {title}",
                f"Outcome: {outcome_name}",
                f"Move: {pct*100:.2f}% за ~{duration}s ({old_price:.3f} → {new_price:.3f})",
                f"Link: {market_link(slug)}",
            ],
        )
        
        # API data (structured)
        alert_data = create_price_move_alert(
            title=title,
            slug=slug,
            outcome=outcome_name,
            old_price=old_price,
            new_price=new_price,
            duration_sec=duration,
            direction=direction
        )
        
        # DUAL SEND! 🚀
        dual_send(msg, alert_data)
        
        squeeze_cooldown_until[key] = ts + SQUEEZE_COOLDOWN_SEC


# ===== USAGE EXAMPLE =====
if __name__ == "__main__":
    print("=" * 50)
    print("POLYALARM → SPACEHUB API INTEGRATION")
    print("=" * 50)
    print()
    print("SETUP STEPS:")
    print("1. Copy this file to same directory as your bot")
    print("2. Set SPACEHUB_API_URL to your Railway API URL")
    print("3. Replace handle_trade_for_whale() with handle_trade_for_whale_MODIFIED()")
    print("4. Replace handle_trade_for_squeeze() with handle_trade_for_squeeze_MODIFIED()")
    print("5. Run your bot as before!")
    print()
    print("TESTING:")
    print(f"  - Telegram: {TG_BOT_TOKEN[:10]}...")
    print(f"  - API: {SPACEHUB_API_URL}")
    print()
    print("=" * 50)
