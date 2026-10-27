import { createClient } from '@/lib/supabase/server'
import { getTokenUnlocks } from '@/lib/services/token-unlock-service'
import TokenUnlocksWorkspace from './TokenUnlocksWorkspace'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Token Unlocks Intelligence | Sumex Market Intelligence',
  description: 'Track upcoming token unlocks, supply dilution risks, vesting schedules, and generate viral research graphics.',
}

export default async function TokenUnlocksPage() {
  const supabase = await createClient()
  const summary = await getTokenUnlocks(supabase)

  return (
    <TokenUnlocksWorkspace
      initialUnlocks={summary.data}
      initialSummary={{
        totalValueUsd: summary.totalValueUsd,
        topUnlock: summary.topUnlock,
        highImpactCount: summary.highImpactCount,
        avgPctSupply: summary.avgPctSupply,
      }}
    />
  )
}
