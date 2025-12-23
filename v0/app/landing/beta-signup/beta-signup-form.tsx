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
    email: z.string().trim().email('Enter a valid email'),
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced'], {
      required_error: 'Select your experience level',
    }),
    goals: z
      .array(z.enum(['habit', 'race', 'fitness', 'injury_prevention']))
      .min(1, 'Select at least one goal'),
    hearAboutUs: z
      .enum(['friend', 'instagram', 'twitter', 'reddit', 'product_hunt', 'search', 'blog', 'other'])
      .optional(),
    hearAboutUsOther: z.string().trim().optional(),
    agreedToTerms: z.boolean().refine((value) => value === true, {
      message: 'You must agree before joining',
    }),
  })
  .refine((data) => data.hearAboutUs !== 'other' || !!data.hearAboutUsOther, {
    path: ['hearAboutUsOther'],
    message: 'Please specify how you heard about us',
  })

type BetaSignupValues = z.infer<typeof betaSignupSchema>

const goalOptions = [
  { value: 'habit', label: 'Build a consistent running habit' },
  { value: 'race', label: 'Train for a race (5K, 10K, half, etc.)' },
  { value: 'fitness', label: 'Improve fitness' },
  { value: 'injury_prevention', label: 'Injury prevention / return safely' },
] as const

const hearAboutUsOptions = [
  { value: 'friend', label: 'Friend or colleague' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'product_hunt', label: 'Product Hunt' },
  { value: 'search', label: 'Search engine' },
  { value: 'blog', label: 'Running blog/website' },
  { value: 'other', label: 'Other' },
] as const

export function BetaSignupForm() {
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
            : null) ?? 'Something went wrong. Please try again.'
        setServerError(message)
        return
      }

      router.push('/beta-signup/thanks')
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Network error. Please try again.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join the Beta Waitlist</CardTitle>
        <CardDescription>We&apos;ll never spam you. Beta updates only.</CardDescription>
      </CardHeader>
      <CardContent>
        {serverError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Unable to submit</AlertTitle>
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
                  <FormLabel>Your email</FormLabel>
                  <FormControl>
                    <Input autoComplete="email" inputMode="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormDescription>We&apos;ll email you when invites roll out.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="experienceLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Running experience</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your experience" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>This helps us tailor your early beta experience.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="goals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary goal</FormLabel>
                  <FormDescription>Select all that apply.</FormDescription>

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
                    <FormLabel>How did you hear about us? (optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      {...(field.value ? { value: field.value } : {})}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a source" />
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
                      <FormLabel>Other</FormLabel>
                      <FormControl>
                        <Input placeholder="Tell us where you found Run-Smart" {...field} />
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
                        I agree to the{' '}
                        <Link className="underline underline-offset-4" href="/landing/privacy">
                          Privacy Policy
                        </Link>{' '}
                        and{' '}
                        <Link className="underline underline-offset-4" href="/landing/terms">
                          Terms of Service
                        </Link>
                      </Label>
                      <FormMessage />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Adding you to the list...' : 'Join the Beta Waitlist'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
