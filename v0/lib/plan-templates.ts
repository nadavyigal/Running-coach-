export type PlanDistanceKey = '5k' | '10k' | 'half-marathon' | 'marathon'

export type PlanTemplateFilter = 'all' | '5k/10k' | 'half-marathon' | 'marathon'

export interface PlanTemplate {
  id: string
  name: string
  description: string
  distanceKey: PlanDistanceKey
  distanceLabel: string
  distanceKm: number
  recommendedWeeks: number
  filter: Exclude<PlanTemplateFilter, 'all'>
  metric: string
  goalCategory: 'speed' | 'endurance'
  heroImageSrc: string
  accentClassName: string
  isComingSoon?: boolean
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: '10k-plan',
    name: '10k Plan',
    description:
      "Train for your first 10k with a beginner-friendly plan, or go get your new PB as an experienced runner.",
    distanceKey: '10k',
    distanceLabel: '10K',
    distanceKm: 10,
    recommendedWeeks: 10,
    filter: '5k/10k',
    metric: '10k_time',
    goalCategory: 'speed',
    heroImageSrc: '/placeholder.jpg',
    accentClassName: 'border-yellow-300',
  },
  {
    id: '5k-improvement',
    name: '5k Improvement Plan',
    description:
      'Build speed and consistency to run a faster 5k with a structured, progressive plan.',
    distanceKey: '5k',
    distanceLabel: '5K',
    distanceKm: 5,
    recommendedWeeks: 8,
    filter: '5k/10k',
    metric: '5k_time',
    goalCategory: 'speed',
    heroImageSrc: '/placeholder.jpg',
    accentClassName: 'border-blue-300',
  },
  {
    id: 'half-marathon-plan',
    name: 'Half Marathon Plan',
    description:
      'Train toward a confident 21.1K with steady weekly progression and smart long runs.',
    distanceKey: 'half-marathon',
    distanceLabel: 'Half Marathon',
    distanceKm: 21.1,
    recommendedWeeks: 12,
    filter: 'half-marathon',
    metric: 'half_marathon_time',
    goalCategory: 'endurance',
    heroImageSrc: '/placeholder.jpg',
    accentClassName: 'border-emerald-300',
  },
  {
    id: 'marathon-plan',
    name: 'Marathon Plan',
    description:
      'Build endurance safely toward 42.2K with a progressive plan and recovery baked in.',
    distanceKey: 'marathon',
    distanceLabel: 'Marathon',
    distanceKm: 42.2,
    recommendedWeeks: 12,
    filter: 'marathon',
    metric: 'marathon_time',
    goalCategory: 'endurance',
    heroImageSrc: '/placeholder.jpg',
    accentClassName: 'border-violet-300',
  },
  {
    id: '10-mile-plan',
    name: '10 Mile Plan',
    description:
      'A focused plan to build toward a strong 10-mile effort. (Coming soon)',
    distanceKey: '10k',
    distanceLabel: '10 Mile',
    distanceKm: 16.1,
    recommendedWeeks: 12,
    filter: '5k/10k',
    metric: '10_mile_time',
    goalCategory: 'endurance',
    heroImageSrc: '/placeholder.jpg',
    accentClassName: 'border-orange-300',
    isComingSoon: true,
  },
]

