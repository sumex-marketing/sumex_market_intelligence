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
 * Fetch market data for a list of CoinGecko IDs.
 * Returns coin data with 1h/24h/7d price changes.
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

  return { data: result.data, status: 200, error: null }
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
