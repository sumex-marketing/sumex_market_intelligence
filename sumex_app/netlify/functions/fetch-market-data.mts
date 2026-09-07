import type { Config } from "@netlify/functions"

export default async function handler(req: Request) {
  const siteUrl = process.env.URL || "http://localhost:3000"
  const cronUrl = `${siteUrl}/api/cron/fetch-market-data`

  try {
    const res = await fetch(cronUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.CRON_SECRET ?? ""}`
      }
    })
    const data = await res.json()
    return new Response(JSON.stringify(data), { status: res.status })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}

export const config: Config = {
  schedule: "*/15 * * * *"
}
