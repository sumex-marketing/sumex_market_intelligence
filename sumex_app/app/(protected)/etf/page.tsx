import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function EtfDeskPage() {
  redirect('/macro?tab=etf')
}
