'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const betaSignupSchema = z
  .object({
    email: z.string().trim().email('נא להזין כתובת אימייל תקינה'),
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced'], {
      required_error: 'נא לבחור רמת ניסיון',
    }),
    goals: z
      .array(z.enum(['habit', 'race', 'fitness', 'injury_prevention']))
      .min(1, 'נא לבחור לפחות מטרה אחת'),
    hearAboutUs: z
      .enum(['friend', 'instagram', 'twitter', 'reddit', 'product_hunt', 'search', 'blog', 'whatsapp', 'other'])
      .optional(),
    hearAboutUsOther: z.string().trim().optional(),
    agreedToTerms: z.boolean().refine((value) => value === true, {
      message: 'יש לאשר את התנאים כדי להירשם',
    }),
  })
  .refine((data) => data.hearAboutUs !== 'other' || !!data.hearAboutUsOther, {
    path: ['hearAboutUsOther'],
    message: 'נא לציין איך שמעת עלינו',
  })

type BetaSignupValues = z.infer<typeof betaSignupSchema>

const goalOptions = [
  { value: 'habit', label: 'לבנות הרגל ריצה קבוע' },
  { value: 'race', label: 'להתאמן לתחרות (5K, 10K, חצי מרתון וכו\')' },
  { value: 'fitness', label: 'לשפר כושר גופני' },
  { value: 'injury_prevention', label: 'מניעת פציעות / חזרה בטוחה לריצה' },
] as const

const hearAboutUsOptions = [
  { value: 'friend', label: 'חבר או קולגה' },
  { value: 'whatsapp', label: 'קבוצת וואטסאפ' },
  { value: 'instagram', label: 'אינסטגרם' },
  { value: 'twitter', label: 'טוויטר/X' },
  { value: 'reddit', label: 'רדיט' },
  { value: 'product_hunt', label: 'Product Hunt' },
  { value: 'search', label: 'מנוע חיפוש' },
  { value: 'blog', label: 'בלוג/אתר ריצה' },
  { value: 'other', label: 'אחר' },
] as const

export function BetaSignupFormHe() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const defaultValues = useMemo<BetaSignupValues>(
    () => ({
      email: '',
      experienceLevel: 'beginner',
      goals: ['habit'],
      hearAboutUs: undefined,
      hearAboutUsOther: '',
      agreedToTerms: false,
    }),
    []
  )

  const form = useForm<BetaSignupValues>({
    resolver: zodResolver(betaSignupSchema),
    defaultValues,
    mode: 'onTouched',
  })

  const hearAboutUs = form.watch('hearAboutUs')

  const onSubmit = async (values: BetaSignupValues) => {
    setServerError(null)

    try {
      const response = await fetch('/api/beta-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          (payload &&
          typeof payload === 'object' &&
          'error' in payload &&
          typeof (payload as { error?: unknown }).error === 'string'
            ? String((payload as { error: string }).error)
            : null) ?? 'משהו השתבש. נא לנסות שוב.'
        setServerError(message)
        return
      }

      router.push('/landing/beta-signup-he/thanks')
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'שגיאת רשת. נא לנסות שוב.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>הצטרפו לרשימת ההמתנה לבטא</CardTitle>
        <CardDescription>לא נשלח ספאם. רק עדכונים על הבטא.</CardDescription>
      </CardHeader>
      <CardContent>
        {serverError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>לא ניתן לשלוח</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>כתובת האימייל שלך</FormLabel>
                  <FormControl>
                    <Input autoComplete="email" inputMode="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormDescription>נשלח לך הודעה כשההזמנות יתחילו לצאת.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="experienceLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ניסיון בריצה</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר/י רמת ניסיון" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="beginner">מתחיל/ה</SelectItem>
                      <SelectItem value="intermediate">בינוני/ת</SelectItem>
                      <SelectItem value="advanced">מתקדם/ת</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>זה עוזר לנו להתאים את חווית הבטא עבורך.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="goals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מטרה עיקרית</FormLabel>
                  <FormDescription>ניתן לבחור יותר מאפשרות אחת.</FormDescription>

                  <div className="grid gap-3 rounded-lg border p-4">
                    {goalOptions.map((goal) => {
                      const checked = field.value?.includes(goal.value) ?? false
                      return (
                        <div key={goal.value} className="flex items-start gap-3">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) => {
                              const nextChecked = next === true
                              const current = new Set(field.value ?? [])
                              if (nextChecked) {
                                current.add(goal.value)
                              } else {
                                current.delete(goal.value)
                              }
                              field.onChange(Array.from(current))
                            }}
                            id={`goal-${goal.value}`}
                          />
                          <Label htmlFor={`goal-${goal.value}`} className="cursor-pointer leading-6">
                            {goal.label}
                          </Label>
                        </div>
                      )
                    })}
                  </div>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3">
              <FormField
                control={form.control}
                name="hearAboutUs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>איך שמעת עלינו? (לא חובה)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      {...(field.value ? { value: field.value } : {})}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר/י מקור" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {hearAboutUsOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {hearAboutUs === 'other' && (
                <FormField
                  control={form.control}
                  name="hearAboutUsOther"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>אחר</FormLabel>
                      <FormControl>
                        <Input placeholder="ספר/י לנו איך גילית את Run-Smart" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="agreedToTerms"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(next) => field.onChange(next === true)}
                      id="agree"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="agree" className="cursor-pointer">
                        אני מסכים/ה ל{' '}
                        <Link className="underline underline-offset-4" href="/landing/privacy">
                          מדיניות הפרטיות
                        </Link>{' '}
                        ול{' '}
                        <Link className="underline underline-offset-4" href="/landing/terms">
                          תנאי השימוש
                        </Link>
                      </Label>
                      <FormMessage />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'מוסיף אותך לרשימה...' : 'הצטרף/י לרשימת ההמתנה'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
