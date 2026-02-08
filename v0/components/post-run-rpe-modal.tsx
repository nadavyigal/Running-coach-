'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Activity } from 'lucide-react'

interface PostRunRpeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (rpe: number) => void
  onSkip?: () => void
  defaultRpe?: number
}

const getRpeLabel = (rpe: number) => {
  if (rpe >= 9) return 'Max effort'
  if (rpe >= 7) return 'Hard'
  if (rpe >= 5) return 'Moderate'
  if (rpe >= 3) return 'Easy'
  return 'Very easy'
}

export function PostRunRpeModal({
  open,
  onOpenChange,
  onSubmit,
  onSkip,
  defaultRpe = 6,
}: PostRunRpeModalProps) {
  const [rpe, setRpe] = useState(defaultRpe)

  useEffect(() => {
    if (open) {
      setRpe(defaultRpe)
    }
  }, [open, defaultRpe])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Rate Your Effort
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">How hard did that run feel?</Label>
            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Very easy</span>
                <span className="text-lg font-semibold text-slate-900">{rpe}/10</span>
                <span className="text-xs text-slate-500">Max</span>
              </div>
              <div className="mt-2 text-sm text-slate-700">{getRpeLabel(rpe)}</div>
              <div className="mt-4">
                <Slider
                  value={[rpe]}
                  onValueChange={(value) => setRpe(value[0])}
                  min={1}
                  max={10}
                  step={1}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onSkip?.()}
            >
              Skip
            </Button>
            <Button
              className="flex-1"
              onClick={() => onSubmit(rpe)}
            >
              Save Effort
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
