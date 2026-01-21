"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface WeeklyRecapNotificationBannerProps {
  onViewRecap: () => void;
  onDismiss?: () => void;
}

export function WeeklyRecapNotificationBanner({
  onViewRecap,
  onDismiss,
}: WeeklyRecapNotificationBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleClose = () => {
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-500/90 px-4 py-3 text-white shadow-lg"
    >
      <div>
        <p className="text-sm font-semibold">Your weekly recap is ready! 🎉</p>
        <p className="text-xs text-emerald-100">Catch the highlights before you run.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="px-3 py-1 text-white border-white"
          onClick={() => {
            onViewRecap();
            handleClose();
          }}
        >
          View Recap
        </Button>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30"
          aria-label="Dismiss weekly recap notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
