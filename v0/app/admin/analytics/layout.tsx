import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check admin access (same pattern as existing admin dashboard)
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || []
  const cookieStore = await cookies()
  const userEmail = cookieStore.get('user_email')?.value

  if (!userEmail || !adminEmails.includes(userEmail.trim())) {
    redirect('/admin/dashboard')
  }

  return <>{children}</>
}
