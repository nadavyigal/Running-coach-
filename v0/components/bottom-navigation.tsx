"use client"

import { Button } from "@/components/ui/button"
import { Home, Calendar, Play, MessageCircle, User } from "lucide-react"

// Version tracking for deployment verification
const APP_VERSION = 'v1.2.0';

interface BottomNavigationProps {
  currentScreen: string
  onScreenChange: (screen: string) => void
}

export function BottomNavigation({ currentScreen, onScreenChange }: BottomNavigationProps) {
  const navItems = [
    { id: "today", icon: Home, label: "Today" },
    { id: "plan", icon: Calendar, label: "Plan" },
    { id: "record", icon: Play, label: "Record", isSpecial: true },
	    { id: "chat", icon: MessageCircle, label: "Coach" },
	    { id: "profile", icon: User, label: "Profile" },
	  ]

	  return (
	    <nav
      className="fixed z-50 bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-white/85 backdrop-blur-xl border border-border/70 shadow-[0_12px_30px_rgba(0,0,0,0.12)] px-5 py-3 rounded-3xl animate-in slide-in-from-bottom duration-500"
      aria-label="Main navigation"
    >
      <div className="flex justify-around items-center relative">
        {navItems.map((item, index) => {
          const isActive = currentScreen === item.id && !item.isSpecial

          return (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              onClick={() => {
                console.log(`[navigation] 🎯 Clicked ${item.label} (${item.id})`);
                onScreenChange(item.id);
              }}
              className={`relative flex flex-col items-center gap-1 h-auto transition-all duration-200 ${
                item.isSpecial
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground rounded-full w-14 h-14 hover:scale-105 active:scale-95 shadow-lg p-0"
                  : isActive
                    ? "text-primary scale-105 py-2 px-3"
                    : "text-foreground/60 hover:text-foreground hover:scale-105 py-2 px-3"
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
              aria-label={`Navigate to ${item.label}`}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && !item.isSpecial && (
                <div className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-primary animate-in zoom-in duration-200" />
              )}
              <item.icon className={`${item.isSpecial ? "h-7 w-7" : "h-5 w-5"}`} aria-hidden="true" />
              {!item.isSpecial && <span className="text-xs font-medium">{item.label}</span>}
            </Button>
          )
        })}
      </div>

      {/* Version indicator */}
      <div className="absolute bottom-0.5 right-2 text-[8px] text-foreground/30 select-none">
        {APP_VERSION}
      </div>
    </nav>
  )
}
