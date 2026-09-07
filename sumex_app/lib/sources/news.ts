/**
 * News & Catalysts Discovery Source Adapter
 *
 * Pulls from primary reputable crypto publication RSS feeds:
 * - Cointelegraph
 * - Decrypt
 * - The Block
 *
 * Extracts and categorizes articles into regulatory, institutional,
 * protocol, and market catalysts with relevance scoring.
 */

export interface NormalizedNewsItem {
  title: string
  url: string
  publisher: string
  published_at: string
  summary: string | null
  category: string
  relevance_score: number
}

const RSS_FEEDS = [
  { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
]

function cleanXmlText(str: string): string {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function extractTag(itemXml: string, tag: string): string | null {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`, 'is')
  const cdataMatch = itemXml.match(cdataRegex)
  if (cdataMatch) return cleanXmlText(cdataMatch[1])

  const normalRegex = new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, 'is')
  const normalMatch = itemXml.match(normalRegex)
  if (normalMatch) return cleanXmlText(normalMatch[1])

  return null
}

function detectCategory(title: string, summary: string): string {
  const text = `${title} ${summary}`.toLowerCase()
  if (text.match(/sec|cftc|regulation|regulatory|doj|court|lawsuit|fbi|treasury|sanction/)) {
    return 'regulatory'
  }
  if (text.match(/etf|blackrock|fidelity|institutional|flow|fidelity|franklin|nasdaq|grayscale/)) {
    return 'institutional'
  }
  if (text.match(/hack|exploit|stolen|drain|vulnerability|outage|attack/)) {
    return 'security'
  }
  if (text.match(/upgrade|fork|hardfork|protocol|eip|solana|layer 2|validator|staking/)) {
    return 'protocol'
  }
  return 'market'
}

function calculateRelevance(title: string, summary: string): number {
  const text = `${title} ${summary}`.toLowerCase()
  let score = 0.5

  if (text.match(/bitcoin|btc|ethereum|eth|solana|sol/)) score += 0.2
  if (text.match(/etf|sec|fomc|fed|inflation|cpi|interest rate/)) score += 0.2
  if (text.match(/record|surge|plunge|crash|all-time high|ath|billion|million/)) score += 0.1

  return Math.min(1.0, Math.max(0.1, Math.round(score * 100) / 100))
}

export async function fetchCryptoNewsFeeds(): Promise<NormalizedNewsItem[]> {
  const results: NormalizedNewsItem[] = []

  await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SumexBot/1.0)',
            Accept: 'application/rss+xml, application/xml, text/xml',
          },
          next: { revalidate: 0 },
        })

        if (!res.ok) return

        const xml = await res.text()
        const itemRegex = /<item\b[^>]*>(.*?)<\/item>/gis
        let match: RegExpExecArray | null

        while ((match = itemRegex.exec(xml)) !== null) {
          const itemContent = match[1]
          const title = extractTag(itemContent, 'title')
          const link = extractTag(itemContent, 'link') || extractTag(itemContent, 'guid')
          const pubDate = extractTag(itemContent, 'pubDate')
          const description = extractTag(itemContent, 'description')

          if (!title || !link) continue

          const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
          const category = detectCategory(title, description ?? '')
          const relevance = calculateRelevance(title, description ?? '')

          results.push({
            title,
            url: link,
            publisher: feed.name,
            published_at: publishedAt,
            summary: description ? description.slice(0, 500) : null,
            category,
            relevance_score: relevance,
          })
        }
      } catch (err) {
        console.error(`Error fetching RSS feed ${feed.name}:`, err)
      }
    })
  )

  // Deduplicate by URL and sort newest first
  const seenUrls = new Set<string>()
  const uniqueItems: NormalizedNewsItem[] = []

  for (const item of results) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url)
      uniqueItems.push(item)
    }
  }

  return uniqueItems.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
}
