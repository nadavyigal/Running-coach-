import { redirect } from 'next/navigation'

export default function RunReportRedirectPage({ params }: { params: { runId: string } }) {
  redirect(`/?screen=run-report&runId=${encodeURIComponent(params.runId)}`)
}

