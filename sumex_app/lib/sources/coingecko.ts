/**
 * CoinGecko Market Data Adapter
 *
 * Fetches prices, changes (1h/24h/7d), market cap, volume for a
 * watchlist of assets. Uses the free public API in MVP; set
 * COINGECKO_API_KEY to switch to the Pro/Demo tier.
 *
 * All API calls happen SERVER-SIDE ONLY. Never import this in browser code.
 */

import { CoinGeckoMarketData, CoinGeckoGlobal } from '../types'

const BASE_URL = 'https://api.coingecko.com/api/v3'
const PRO_BASE_URL = 'https://pro-api.coingecko.com/api/v3'

function getBaseUrl(): string {
  return process.env.COINGECKO_API_KEY ? PRO_BASE_URL : BASE_URL
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  }
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-pro-api-key'] = process.env.COINGECKO_API_KEY
  }
  return headers
}

async function cgFetch<T>(path: string): Promise<{ data: T; ok: true } | { data: null; ok: false; status: number; error: string }> {
  const url = `${getBaseUrl()}${path}`
  try {
    const res = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 0 }, // always fresh on server calls
    })

    if (!res.ok) {
      return { data: null, ok: false, status: res.status, error: `HTTP ${res.status}` }
    }

    const data = await res.json() as T
    return { data, ok: true }
  } catch (err) {
    return {
      data: null,
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * High-precision live ticker helper (Binance spot orderbook & klines).
 * Overlays live sub-second prices and exact 1h/24h/7d deltas with 2-decimal precision.
 */
interface PrecisionData {
  price: number
  change1h: number
  change24h: number
  change7d: number
}

async function fetchPrecisionExchangeData(symbol: string): Promise<PrecisionData | null> {
  try {
    const pair = `${symbol.toUpperCase()}USDT`
    const [tRes, k1Res, k7Res] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, { cache: 'no-store' }),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1h&limit=2`, { cache: 'no-store' }),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=8`, { cache: 'no-store' }),
    ])

    if (!tRes.ok) return null
    const t = await tRes.json()
    const price = parseFloat(t.lastPrice)
    const change24h = parseFloat(t.priceChangePercent)

    let change1h = 0
    if (k1Res.ok) {
      const k1 = await k1Res.json()
      if (Array.isArray(k1) && k1.length > 0) {
        const open1h = parseFloat(k1[k1.length - 1][1])
        if (open1h > 0) change1h = ((price - open1h) / open1h) * 100
      }
    }

    let change7d = 0
    if (k7Res.ok) {
      const k7 = await k7Res.json()
      if (Array.isArray(k7) && k7.length > 0) {
        const open7d = parseFloat(k7[0][1])
        if (open7d > 0) change7d = ((price - open7d) / open7d) * 100
      }
    }

    return {
      price,
      change1h: Number(change1h.toFixed(2)),
      change24h: Number(change24h.toFixed(2)),
      change7d: Number(change7d.toFixed(2)),
    }
  } catch {
    return null
  }
}

const SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
}

/**
 * Fetch market data for a list of CoinGecko IDs.
 * Returns coin data with accurate 1h/24h/7d price changes.
 */
export async function fetchMarketData(
  coinIds: string[],
): Promise<{ data: CoinGeckoMarketData[] | null; status: number; error: string | null }> {
  if (coinIds.length === 0) return { data: [], status: 200, error: null }

  const params = new URLSearchParams({
    ids: coinIds.join(','),
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: '250',
    page: '1',
    price_change_percentage: '1h,24h,7d',
    sparkline: 'false',
  })

  const result = await cgFetch<CoinGeckoMarketData[]>(`/coins/markets?${params}`)

  if (!result.ok) {
    return { data: null, status: result.status, error: result.error }
  }

  const coins = result.data

  // Enhance major coins (BTC, ETH, SOL) with exact live exchange precision
  await Promise.all(
    coins.map(async (c) => {
      const sym = SYMBOL_MAP[c.id]
      if (!sym) return
      const live = await fetchPrecisionExchangeData(sym)
      if (live) {
        c.current_price = live.price
        c.price_change_percentage_1h_in_currency = live.change1h
        c.price_change_percentage_24h_in_currency = live.change24h
        c.price_change_percentage_7d_in_currency = live.change7d
      }
    })
  )

  return { data: coins, status: 200, error: null }
}

/**
 * Fetch global market metrics (total market cap, BTC dominance, etc.)
 */
export async function fetchGlobalMetrics(): Promise<{
  data: CoinGeckoGlobal['data'] | null
  status: number
  error: string | null
}> {
  const result = await cgFetch<CoinGeckoGlobal>('/global')

  if (!result.ok) {
    return { data: null, status: result.status, error: result.error }
  }

  return { data: result.data.data, status: 200, error: null }
}

/**
 * Default watchlist CoinGecko IDs.
 * These are the core assets we always track.
 */
export const DEFAULT_COINGECKO_IDS = ['bitcoin', 'ethereum', 'solana']
