import { Sparkles, Flame, Activity, Heart, ShieldCheck, ShieldAlert, Cpu } from 'lucide-react'
import { Card } from '@/components/ui/card'

export interface Insight {
  type: 'effort' | 'pacing' | 'recovery' | 'general'
  title: string
  message: string
  confidence?: 'High' | 'Med' | 'Low'
  isPositive?: boolean
}

interface KeyInsightsProps {
  insights: Insight[]
  isGenerating?: boolean
  onRegenerate?: () => void
  variant?: 'garmin' | 'light'
}

function getIconForType(type: Insight['type'], isPositive: boolean = true) {
  switch (type) {
    case 'effort':   return <Flame className={`w-4 h-4 ${isPositive ? 'text-orange-400' : 'text-rose-400'}`} />
    case 'pacing':   return <Activity className={`w-4 h-4 ${isPositive ? 'text-[#40DCBE]' : 'text-amber-400'}`} />
    case 'recovery': return <Heart className={`w-4 h-4 ${isPositive ? 'text-sky-400' : 'text-violet-400'}`} />
    default:         return <Sparkles className="w-4 h-4 text-[#40DCBE]" />
  }
}

function getConfidenceBadge(confidence?: string, dark = false) {
  if (!confidence) return null
  if (confidence === 'High') return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${dark ? 'text-[#40DCBE] bg-[#40DCBE]/10' : 'text-emerald-600 bg-emerald-500/10'}`}>
      <ShieldCheck className="w-2.5 h-2.5" /> High
    </span>
  )
  if (confidence === 'Med') return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${dark ? 'text-amber-400 bg-amber-500/10' : 'text-amber-600 bg-amber-500/10'}`}>
      <ShieldAlert className="w-2.5 h-2.5" /> Med
    </span>
  )
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${dark ? 'text-white/30 bg-white/5' : 'text-rose-600 bg-rose-500/10'}`}>
      <Cpu className="w-2.5 h-2.5" /> Low
    </span>
  )
}

export function KeyInsights({ insights, isGenerating, onRegenerate, variant = 'light' }: KeyInsightsProps) {

  // ─── LOADING STATE ────────────────────────────────────────────────────────
  if (isGenerating) {
    if (variant === 'garmin') {
      return (
        <div className="mx-4 bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#40DCBE] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/40">Coach Analysis</span>
          </div>
          {[1, 2].map(i => (
            <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          <h3 className="text-lg font-bold">Coach Insights</h3>
        </div>
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse bg-muted/50 border-none shadow-sm h-20" />
        ))}
      </div>
    )
  }

  if (!insights || insights.length === 0) return null

  // ─── GARMIN DARK — bordered insight list ─────────────────────────────────
  if (variant === 'garmin') {
    return (
      <div className="mx-4 bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#40DCBE]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#40DCBE]/70">
              Coach Analysis
            </span>
          </div>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-[10px] font-semibold text-white/25 hover:text-white/50 transition-colors uppercase tracking-widest"
            >
              Refresh
            </button>
          )}
        </div>

        <div className="space-y-4">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={`border-l-2 pl-3.5 ${
                insight.isPositive !== false ? 'border-[#40DCBE]/50' : 'border-[#EED678]/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {getIconForType(insight.type, insight.isPositive)}
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider flex-1">
                  {insight.title}
                </span>
                {getConfidenceBadge(insight.confidence, true)}
              </div>
              <p className="text-sm text-white/75 leading-relaxed">{insight.message}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── LIGHT — horizontal scrolling chips ──────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-base">Coach Insights</h3>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="text-xs font-semibold text-primary/70 hover:text-primary transition-colors"
          >
            Regenerate
          </button>
        )}
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {insights.slice(0, 4).map((insight, i) => (
          <div
            key={i}
            className={`flex-none w-52 rounded-2xl p-3.5 border ${
              insight.isPositive !== false
                ? 'bg-emerald-500/5 border-emerald-500/15'
                : 'bg-amber-500/5 border-amber-500/15'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              {getIconForType(insight.type, insight.isPositive)}
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-1 truncate">
                {insight.title}
              </span>
              {getConfidenceBadge(insight.confidence)}
            </div>
            <p className="text-xs text-foreground/70 leading-snug line-clamp-3">
              {insight.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
