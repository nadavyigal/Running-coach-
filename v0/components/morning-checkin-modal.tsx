"use client"

import { useMemo, useState } from "react"
import { Brain, Moon, Sparkles } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"

export interface MorningCheckInData {
  date: string
  sleepHours: number
  sleepQuality: number
  energyLevel: number
  moodScore: number
  sorenessLevel: number
  stressLevel: number
  motivationLevel: number
}

interface MorningCheckInModalProps {
  open: boolean
  loading?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: MorningCheckInData) => Promise<void>
}

const INITIAL_DATA = (): MorningCheckInData => ({
  date: new Date().toISOString().split("T")[0] ?? new Date().toISOString(),
  sleepHours: 7,
  sleepQuality: 6,
  energyLevel: 6,
  moodScore: 6,
  sorenessLevel: 4,
  stressLevel: 4,
  motivationLevel: 6,
})

function ScoreRow(props: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (next: number) => void
}) {
  const { label, value, min = 1, max = 10, step = 1, onChange } = props
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="font-semibold">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => onChange(values[0] ?? value)}
      />
    </div>
  )
}

export function MorningCheckInModal({
  open,
  loading = false,
  onOpenChange,
  onSubmit,
}: MorningCheckInModalProps) {
  const [formData, setFormData] = useState<MorningCheckInData>(INITIAL_DATA)

  const titleIcon = useMemo(() => (loading ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Brain className="h-4 w-4" />), [loading])

  const handleSubmit = async () => {
    await onSubmit(formData)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (nextOpen) {
          setFormData(INITIAL_DATA())
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {titleIcon}
            60-second morning check-in
          </DialogTitle>
          <DialogDescription>
            Quick inputs to improve today&apos;s readiness and workout guidance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ScoreRow
            label="Sleep hours"
            value={formData.sleepHours}
            min={3}
            max={12}
            step={0.5}
            onChange={(sleepHours) => setFormData((prev) => ({ ...prev, sleepHours }))}
          />
          <ScoreRow
            label="Sleep quality"
            value={formData.sleepQuality}
            onChange={(sleepQuality) => setFormData((prev) => ({ ...prev, sleepQuality }))}
          />
          <ScoreRow
            label="Energy"
            value={formData.energyLevel}
            onChange={(energyLevel) => setFormData((prev) => ({ ...prev, energyLevel }))}
          />
          <ScoreRow
            label="Mood"
            value={formData.moodScore}
            onChange={(moodScore) => setFormData((prev) => ({ ...prev, moodScore }))}
          />
          <ScoreRow
            label="Soreness"
            value={formData.sorenessLevel}
            onChange={(sorenessLevel) => setFormData((prev) => ({ ...prev, sorenessLevel }))}
          />
          <ScoreRow
            label="Stress"
            value={formData.stressLevel}
            onChange={(stressLevel) => setFormData((prev) => ({ ...prev, stressLevel }))}
          />
          <ScoreRow
            label="Motivation"
            value={formData.motivationLevel}
            onChange={(motivationLevel) => setFormData((prev) => ({ ...prev, motivationLevel }))}
          />

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
              Later
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
              <Moon className="mr-1 h-4 w-4" />
              {loading ? "Saving..." : "Complete check-in"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

