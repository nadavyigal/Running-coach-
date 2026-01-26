'use client'

import { useEffect, useMemo, useState } from 'react'
import { MessageCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

export function ShareWaitlistHe() {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  const fallbackShareUrl = 'https://runsmart-ai.com/landing/beta-signup-he'

  useEffect(() => {
    setShareUrl(new URL('/landing/beta-signup-he', window.location.origin).toString())
  }, [])

  const effectiveShareUrl = shareUrl || fallbackShareUrl

  const whatsappMessage = useMemo(() => {
    const text = `היי! נרשמתי לבטא של Run-Smart - מאמן ריצה חכם עם AI שמתאים את האימונים לחיים שלך.

הם נותנים 50% הנחה לכל החיים למצטרפים הראשונים!

הנה הקישור להרשמה:`
    return `https://wa.me/?text=${encodeURIComponent(text + '\n' + effectiveShareUrl)}`
  }, [effectiveShareUrl])

  const tweetIntent = useMemo(() => {
    const text =
      'נרשמתי לבטא של Run-Smart! מאמן ריצה עם AI שמתאים את האימונים לחיים שלך. הצטרפו אליי:'
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(effectiveShareUrl)}`
  }, [effectiveShareUrl])

  const copy = async () => {
    try {
      const urlToCopy = shareUrl || new URL('/landing/beta-signup-he', window.location.origin).toString()
      await navigator.clipboard.writeText(urlToCopy)
      setCopied(true)
      toast({ title: 'הקישור הועתק', description: 'שלחו אותו לחבר/ה שרץ/ה.' })
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      toast({
        title: 'לא ניתן להעתיק קישור',
        description: error instanceof Error ? error.message : 'נא להעתיק ידנית.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={effectiveShareUrl} aria-label="קישור לשיתוף" className="text-left" dir="ltr" />
        <Button onClick={copy} type="button" className="sm:w-40">
          {copied ? 'הועתק!' : 'העתק קישור'}
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="default" className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
          <a href={whatsappMessage} target="_blank" rel="noreferrer">
            <MessageCircle className="me-2 h-4 w-4" />
            שתפו בוואטסאפ
          </a>
        </Button>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <a href={tweetIntent} target="_blank" rel="noreferrer">
            שתפו בטוויטר/X
          </a>
        </Button>
      </div>
    </div>
  )
}
