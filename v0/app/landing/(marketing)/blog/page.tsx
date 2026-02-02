import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Run-Smart blog.',
  alternates: { canonical: '/blog' },
  robots: { index: false, follow: false },
}

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Blog</CardTitle>
          <CardDescription>Coming soon.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>We&apos;ll share build-in-public updates, training tips, and beta stories here.</p>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

