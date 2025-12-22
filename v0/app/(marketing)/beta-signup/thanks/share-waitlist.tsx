'use client'

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

export function ShareWaitlist() {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  const fallbackShareUrl = 'https://runsmart.ai/beta-signup'

  useEffect(() => {
    setShareUrl(new URL('/beta-signup', window.location.origin).toString())
  }, [])

  const effectiveShareUrl = shareUrl || fallbackShareUrl

  const tweetIntent = useMemo(() => {
    const text =
      'Just joined the Run-Smart beta! AI-powered running coach that actually adapts to your life. Join me:'
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(effectiveShareUrl)}`
  }, [effectiveShareUrl])

  const copy = async () => {
    try {
      const urlToCopy = shareUrl || new URL('/beta-signup', window.location.origin).toString()
      await navigator.clipboard.writeText(urlToCopy)
      setCopied(true)
      toast({ title: 'Link copied', description: 'Send it to a runner friend.' })
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      toast({
        title: 'Could not copy link',
        description: error instanceof Error ? error.message : 'Please copy it manually.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={effectiveShareUrl} aria-label="Share link" />
        <Button onClick={copy} type="button" className="sm:w-40">
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      <Button asChild variant="secondary" className="w-full sm:w-auto">
        <a href={tweetIntent} target="_blank" rel="noreferrer">
          Share on Twitter/X
        </a>
      </Button>
    </div>
  )
}
