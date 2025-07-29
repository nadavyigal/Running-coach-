'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Plan } from '@/lib/db'
import { PlanComplexityEngineService, type PlanComplexityEngine } from '@/lib/plan-complexity-engine'

interface Props {
  plan: Plan
  onComplexityChange?: (complexity: PlanComplexityEngine) => void
}

export function PlanComplexityIndicator({ plan, onComplexityChange }: Props) {
  const [engineState, setEngineState] = useState<PlanComplexityEngine | null>(null)

  useEffect(() => {
    const state = PlanComplexityEngineService.initializeFromPlan(plan)
    const updated = PlanComplexityEngineService.updateComplexity(state)
    setEngineState(updated)
    onComplexityChange?.(updated)
  }, [plan, onComplexityChange])

  if (!engineState) return null

  const { complexityScore, planLevel } = engineState

  const badgeClass = planLevel === 'advanced'
    ? 'bg-green-100 text-green-800'
    : planLevel === 'standard'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-gray-100 text-gray-800'

  return (
    <Card className="mb-4" data-testid="plan-complexity-indicator">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Plan Complexity <Badge className={badgeClass}>{planLevel}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div data-testid="complexity-progress">
                <Progress value={complexityScore} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Complexity Score: {complexityScore}/100
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
