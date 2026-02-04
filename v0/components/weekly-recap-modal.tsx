"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { X, Share2 } from "lucide-react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { WeeklyRecap } from "@/lib/habitAnalytics";
import { ENABLE_WEEKLY_RECAP } from "@/lib/featureFlags";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface WeeklyRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  weeklyRecap: WeeklyRecap | null;
}

export function WeeklyRecapModal({ isOpen, onClose, weeklyRecap }: WeeklyRecapModalProps) {
  const [highlightedDay, setHighlightedDay] = useState<number | null>(null);

  const formattedRange = useMemo(() => {
    if (!weeklyRecap) return "";
    return `${format(weeklyRecap.weekStartDate, "MMM d")} - ${format(
      weeklyRecap.weekEndDate,
      "MMM d"
    )}`;
  }, [weeklyRecap]);

  const totalDistance = weeklyRecap?.totalDistance ?? 0;
  const totalRuns = weeklyRecap?.totalRuns ?? 0;
  const avgPace = weeklyRecap?.averagePace ?? "--";
  const durationMinutes = Math.round((weeklyRecap?.totalDuration ?? 0) / 60);
  const distanceChange = weeklyRecap?.weekOverWeekChange.distance ?? 0;
  const changeIcon = distanceChange > 0 ? "↑" : distanceChange < 0 ? "↓" : "-";
  const changeText = `${distanceChange >= 0 ? "+" : ""}${distanceChange}% ${changeIcon}`;

  const dailyDistances = useMemo(() => {
    if (!weeklyRecap || totalRuns === 0) {
      return Array(7).fill(0);
    }
    const averagePerRun = totalDistance / totalRuns;
    return weeklyRecap.dailyRunTotals.map((count) => Number((count * averagePerRun).toFixed(1)));
  }, [weeklyRecap, totalDistance, totalRuns]);

  const maxDistance = Math.max(...dailyDistances, 1);

  const shareSummary = () => {
    if (!weeklyRecap) return;
    const text = `I ran ${totalDistance.toFixed(1)}km this week across ${totalRuns} runs! ${
      weeklyRecap.topAchievement
    }`;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        console.warn("Failed to copy summary");
      });
    }
  };

  useEffect(() => {
    if (!isOpen || !weeklyRecap) return;
    void trackAnalyticsEvent("weekly_recap_modal_opened", {
      week_start_date: weeklyRecap.weekStartDate.toISOString(),
    });
  }, [isOpen, weeklyRecap]);

  useEffect(() => {
    if (!isOpen) {
      setHighlightedDay(null);
    }
  }, [isOpen]);

  if (!ENABLE_WEEKLY_RECAP) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        className="fixed inset-0 m-0 h-[100dvh] w-full max-w-none rounded-none bg-white p-0 shadow-xl animate-in slide-in-from-bottom-5 duration-500"
        hideClose
      >
        <div className="flex flex-col h-full">
          <header className="relative flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Weekly Recap</p>
              <h1 className="text-2xl font-semibold text-gray-900">{formattedRange}</h1>
            </div>
            <button
              aria-label="Close recap modal"
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto p-5 space-y-6">
            <section className="space-y-4">
              <div className="text-5xl font-bold text-gray-900">{totalDistance.toFixed(1)} km</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Runs" value={totalRuns.toString()} />
                <StatCard label="Duration" value={`${durationMinutes} min`} />
                <StatCard label="Avg pace" value={avgPace} />
              </div>
              <div className="text-sm font-semibold text-emerald-600">{changeText}</div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Daily breakdown</h2>
                <p className="text-xs text-gray-500">Tap a bar to view details</p>
              </div>
              <div className="grid grid-cols-7 gap-3">
                {dailyDistances.map((distance, index) => {
                  const height = Math.max(10, (distance / maxDistance) * 100);
                  return (
                    <button
                      key={index}
                      type="button"
                      className="flex flex-col items-center gap-1"
                      onClick={() => setHighlightedDay(index)}
                    >
                      <div className="w-full rounded-full bg-slate-100">
                        <div
                          className="h-24 w-full rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500 transition-all duration-200"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-500">{dayLabels[index]}</span>
                      <span className="text-[10px] text-gray-400">{distance.toFixed(1)} km</span>
                    </button>
                  );
                })}
              </div>
              {highlightedDay !== null && (
                <p className="text-sm text-gray-600">
                  {dayLabels[highlightedDay]}: {dailyDistances[highlightedDay].toFixed(1)} km across{" "}
                  {weeklyRecap?.dailyRunTotals[highlightedDay] ?? 0} run
                  {(weeklyRecap?.dailyRunTotals[highlightedDay] ?? 0) === 1 ? "" : "s"}
                </p>
              )}
            </section>

            <section className="space-y-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
              <h2 className="text-lg font-semibold text-gray-900">Achievements</h2>
              <p className="text-sm text-gray-700">{weeklyRecap?.topAchievement}</p>
              <p className="text-sm text-gray-500">
                {weeklyRecap?.streakStatus === "continued"
                  ? `Continued ${weeklyRecap.currentStreak}-week streak!`
                  : weeklyRecap?.streakStatus === "started"
                    ? "Started a new streak!"
                    : "Streak broken. Restart with a short easy session."}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Next week preview</h2>
              <p className="text-sm text-gray-700">{weeklyRecap?.nextWeekGoal}</p>
              <p className="text-xs text-gray-500">
                {weeklyRecap?.consistencyScore ?? 0}%
                {weeklyRecap?.consistencyScore >= 80
                  ? " consistency — keep building momentum!"
                  : " consistency — focus on completing 1-2 planned runs this week."}
              </p>
            </section>
          </main>

          <footer className="flex items-center justify-between border-t border-gray-200 px-5 py-4">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={shareSummary}
              aria-label="Share weekly recap summary"
            >
              <Share2 className="h-4 w-4" />
              Share My Week
            </Button>
            <Button variant="default" onClick={onClose}>
              Close
            </Button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
