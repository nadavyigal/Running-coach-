import { AlertTriangle, Database, RotateCcw, Trash2 } from "lucide-react"
import { profileCardVariants, rowItemVariants } from "@/components/profile/variants"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DeveloperToolsAccordionProps {
  onResetAllData: () => void
}

export function DeveloperToolsAccordion({ onResetAllData }: DeveloperToolsAccordionProps) {
  return (
    <section aria-labelledby="advanced-heading" className="space-y-3">
      <div>
        <h2 id="advanced-heading" className="text-lg font-semibold">
          Advanced
        </h2>
        <p className="text-sm text-muted-foreground">Developer and destructive utilities are intentionally de-emphasized.</p>
      </div>

      <Accordion type="single" collapsible className={cn(profileCardVariants({ tone: "warning" }), "px-4")}>
        <AccordionItem value="developer-tools" className="border-b-0">
          <AccordionTrigger className="py-3 no-underline hover:no-underline">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800">
              <Database className="h-4 w-4" />
              Developer Tools
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className={cn(rowItemVariants({ tone: "warning" }), "items-start p-3")}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                <div>
                  <p className="font-medium text-amber-900">Reset App Data</p>
                  <p className="text-sm text-amber-800">
                    Removes local profile, runs, plan cache, and sync state. Use only for diagnostics and QA.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" className="h-9 gap-2" onClick={onResetAllData}>
                <Trash2 className="h-4 w-4" />
                Reset All Data
              </Button>
              <Button variant="outline" className="h-9 gap-2 border-amber-300 text-amber-900">
                <RotateCcw className="h-4 w-4" />
                Keep Section Collapsed
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  )
}
