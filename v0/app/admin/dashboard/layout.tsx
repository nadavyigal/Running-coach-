import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user is admin (you can add email whitelist here)
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [
    'nadav@example.com',
    'admin@runsmart.ai'
  ]

  if (!user || !adminEmails.includes(user.email || '')) {
    redirect('/')
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to App
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="text-sm text-gray-600">{user.email}</div>
        </div>
      </nav>
      {children}
    </div>
  )
}
