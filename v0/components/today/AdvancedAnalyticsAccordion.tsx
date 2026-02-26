"use client"

import type { ReactNode } from "react"
import { todayCardVariants, todayStatusBadgeVariants } from "@/components/today/today-ui"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type AdvancedAnalyticsSection = {
  id: string
  title: string
  description?: string
  content: ReactNode
}

interface AdvancedAnalyticsAccordionProps {
  sections: AdvancedAnalyticsSection[]
}

export function AdvancedAnalyticsAccordion({ sections }: AdvancedAnalyticsAccordionProps) {
  return (
    <section aria-labelledby="today-advanced-heading">
      <Card className={todayCardVariants({ level: "secondary" })}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle id="today-advanced-heading" className="text-sm font-semibold">
              Advanced analytics
            </CardTitle>
            <span className={todayStatusBadgeVariants({ tone: "neutral" })}>Optional detail</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Accordion type="multiple" className="w-full">
            {sections.map((section) => (
              <AccordionItem key={section.id} value={section.id} className="border-border/60 last:border-b-0">
                <AccordionTrigger className="rounded-lg px-1 text-left text-sm font-medium hover:bg-muted/35 hover:no-underline">
                  <div>
                    <p>{section.title}</p>
                    {section.description ? (
                      <p className="mt-0.5 text-xs font-normal text-muted-foreground">{section.description}</p>
                    ) : null}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1">{section.content}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </section>
  )
}
