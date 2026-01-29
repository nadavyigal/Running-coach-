import { cn } from "@/lib/utils"

type RunSmartBrandMarkProps = {
  compact?: boolean
  className?: string
  tone?: "light" | "dark"
  size?: "sm" | "md" | "lg"
}

export function RunSmartBrandMark({
  compact = false,
  className,
  tone = "light",
  size = "md",
}: RunSmartBrandMarkProps) {
  const sizeStyles = {
    sm: {
      container: "px-2.5 py-1",
      icon: "h-6 w-6",
      text: "text-[9px]",
    },
    md: {
      container: "px-3 py-1.5",
      icon: "h-7 w-7",
      text: "text-[10px]",
    },
    lg: {
      container: "px-3.5 py-2",
      icon: "h-9 w-9",
      text: "text-[11px]",
    },
  }

  const sizeClass = sizeStyles[size]

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border shadow-sm backdrop-blur",
        tone === "dark"
          ? "border-white/10 bg-white/10 text-white/80"
          : "border-slate-200/70 bg-white/85 text-slate-600",
        sizeClass.container,
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-[18px] bg-gradient-to-br from-emerald-400/20 via-sky-400/10 to-indigo-400/20 p-0.5",
          sizeClass.icon,
          tone === "dark" && "from-emerald-300/30 via-sky-300/20 to-indigo-300/30",
        )}
      >
        <img
          src="/images/runsmart-logo-oval.png"
          alt="RunSmart logo"
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
        />
      </span>
      {!compact && (
        <span className={cn("font-semibold uppercase tracking-[0.3em]", sizeClass.text)}>
          RunSmart
        </span>
      )}
    </div>
  )
}
