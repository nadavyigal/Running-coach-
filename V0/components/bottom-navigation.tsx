"use client"

import { Button } from "@/components/ui/button"
import { Home, Calendar, Play, MessageCircle, User, BarChart3 } from "lucide-react"

// Version tracking for deployment verification
const APP_VERSION = 'v1.1.0';

interface BottomNavigationProps {
  currentScreen: string
  onScreenChange: (screen: string) => void
}

export function BottomNavigation({ currentScreen, onScreenChange }: BottomNavigationProps) {
  const navItems = [
    { id: "today", icon: Home, label: "Today" },
    { id: "plan", icon: Calendar, label: "Plan" },
    { id: "record", icon: Play, label: "Record", isSpecial: true },
    { id: "analytics", icon: BarChart3, label: "Analytics" },
    { id: "chat", icon: MessageCircle, label: "Coach" },
    { id: "profile", icon: User, label: "Profile" },
  ]

  return (
    <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-2 animate-in slide-in-from-bottom duration-300" aria-label="Main navigation">
      <div className="flex justify-around items-center">
        {navItems.map((item, index) => (
          <Button
            key={item.id}
            variant="ghost"
            size="sm"
            onClick={() => onScreenChange(item.id)}
            className={`flex flex-col items-center gap-1 h-auto py-2 px-3 transition-all duration-200 ${
              item.isSpecial
                ? "bg-green-500 hover:bg-green-600 text-white rounded-full w-12 h-12 hover:scale-110 shadow-lg"
                : currentScreen === item.id
                  ? "text-green-500 scale-110"
                  : "text-gray-700 hover:text-green-500 hover:scale-105"
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
            aria-label={`Navigate to ${item.label}`}
            aria-current={currentScreen === item.id ? "page" : undefined}
          >
            <item.icon className={`h-5 w-5 ${item.isSpecial ? "h-6 w-6" : ""}`} aria-hidden="true" />
            {!item.isSpecial && <span className="text-xs font-medium">{item.label}</span>}
          </Button>
        ))}
      </div>
      {/* Version indicator - helps verify deployment */}
      <div className="absolute bottom-0.5 right-2 text-[8px] text-gray-300 select-none">
        {APP_VERSION}
      </div>
    </nav>
  )
}
