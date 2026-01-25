"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Copy, Download, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { buildGarminManualWorkoutText } from "@/lib/garminManualExport"
import { WorkoutPhasesDisplay } from "@/components/workout-phases-display"
import type { StructuredWorkout } from "@/lib/workout-steps"

interface GarminManualExportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workout: StructuredWorkout | null
}

export function GarminManualExportModal({ open, onOpenChange, workout }: GarminManualExportModalProps) {
  const { toast } = useToast()
  const [isDownloading, setIsDownloading] = useState(false)

  const exportText = useMemo(() => {
    if (!workout) return ""
    return buildGarminManualWorkoutText(workout)
  }, [workout])

  const handleCopy = async () => {
    if (!exportText) return
    try {
      await navigator.clipboard.writeText(exportText)
      toast({ title: "Copied", description: "Workout steps copied to clipboard." })
    } catch (error) {
      console.error("Failed to copy", error)
      toast({ title: "Copy failed", description: "Please try again.", variant: "destructive" })
    }
  }

  const handleDownload = () => {
    if (!exportText || !workout) return
    setIsDownloading(true)
    try {
      const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${workout.name.replace(/\s+/g, "-").toLowerCase()}-garmin-workout.txt`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast({ title: "Downloaded", description: "Garmin workout steps saved." })
    } catch (error) {
      console.error("Failed to download workout", error)
      toast({ title: "Download failed", description: "Please try again.", variant: "destructive" })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleOpenGarmin = () => {
    if (typeof window === "undefined") return
    window.open("https://connect.garmin.com", "_blank", "noopener,noreferrer")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to Garmin (Manual)</DialogTitle>
        </DialogHeader>

        {!workout && (
          <p className="text-sm text-gray-600">
            Workout details are still loading. Please try again in a moment.
          </p>
        )}

        {workout && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <p className="font-semibold">{workout.name}</p>
                {workout.notes && <p className="text-sm text-gray-600">{workout.notes}</p>}
              </CardContent>
            </Card>

            <div>
              <p className="text-sm font-medium mb-2">Workout Steps (Garmin-style)</p>
              <WorkoutPhasesDisplay workout={workout} />
            </div>

            <Card>
              <CardContent className="p-4 space-y-2 text-sm text-gray-600">
                <p className="font-medium text-gray-900">Manual Garmin Connect setup</p>
                <p>1) Open Garmin Connect app.</p>
                <p>2) More &gt; Training &amp; Planning &gt; Workouts &gt; Create a Workout &gt; Run.</p>
                <p>3) Add steps in the same order as shown above.</p>
                <p>4) Save and Send to Device, then sync your watch.</p>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleCopy} disabled={!exportText}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Steps
              </Button>
              <Button variant="outline" onClick={handleDownload} disabled={!exportText || isDownloading}>
                <Download className="h-4 w-4 mr-2" />
                {isDownloading ? "Downloading..." : "Download TXT"}
              </Button>
              <Button variant="outline" onClick={handleOpenGarmin}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Garmin Connect
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
