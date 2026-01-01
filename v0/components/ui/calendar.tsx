"use client"

import type * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 w-full", className)}
      classNames={{
        months: "flex flex-col space-y-4",
        month: "space-y-4 w-full",
        caption: "flex items-center justify-between gap-2 px-1",
        month_caption: "flex items-center justify-between gap-2 px-1",
        caption_label: "text-sm font-medium text-center",
        dropdowns: "flex flex-wrap items-center justify-center gap-2",
        dropdown_root: "relative",
        dropdown: "h-9 rounded-md border border-input bg-background px-2 text-sm",
        months_dropdown: "min-w-[7rem]",
        years_dropdown: "min-w-[5rem]",
        nav: "flex items-center justify-between gap-2",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 touch-manipulation",
        ),
        nav_button_previous: "static",
        nav_button_next: "static",
        table: "w-full border-collapse space-y-1",
        month_grid: "w-full border-collapse space-y-1",
        head_row: "flex",
        weekdays: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 sm:w-10 font-normal text-xs sm:text-sm",
        weekday: "text-muted-foreground rounded-md w-9 sm:w-10 font-normal text-xs sm:text-sm",
        row: "flex w-full mt-2",
        week: "flex w-full mt-2",
        cell: "h-9 w-9 sm:h-10 sm:w-10 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 touch-manipulation",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 sm:h-10 sm:w-10 p-0 font-normal aria-selected:opacity-100 touch-manipulation cursor-pointer"),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 sm:h-10 sm:w-10 p-0 font-normal aria-selected:opacity-100 touch-manipulation cursor-pointer",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50 cursor-not-allowed",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className }) => {
          switch (orientation) {
            case "left":
              return <ChevronLeft className={cn("h-4 w-4", className)} />
            case "right":
              return <ChevronRight className={cn("h-4 w-4", className)} />
            case "up":
              return <ChevronUp className={cn("h-4 w-4", className)} />
            case "down":
              return <ChevronDown className={cn("h-4 w-4", className)} />
            default:
              return <ChevronLeft className={cn("h-4 w-4", className)} />
          }
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
