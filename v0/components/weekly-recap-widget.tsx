"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Loader2 } from "lucide-react";
import { HabitAnalyticsService, type WeeklyRecap } from "@/lib/habitAnalytics";
import { ENABLE_WEEKLY_RECAP } from "@/lib/featureFlags";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { WeeklyRecapModal } from "@/components/weekly-recap-modal";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface WeeklyRecapWidgetProps {
  userId: number | null;
  openRecapSignal?: number;
}

export function WeeklyRecapWidget({
  userId,
  openRecapSignal = 0,
}: WeeklyRecapWidgetProps) {
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const hasTracked = useRef(false);

  const shouldRender = ENABLE_WEEKLY_RECAP && Boolean(userId);
  const service = useMemo(() => new HabitAnalyticsService(), []);
  useEffect(() => {
    if (openRecapSignal > 0) {
      setModalOpen(true);
    }
  }, [openRecapSignal]);

  useEffect(() => {
    if (!shouldRender || !userId) {
      return;
    }

    let isMounted = true;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    setLoading(true);
    service
      .generateWeeklyRecap(userId, weekStart)
      .then((data) => {
        if (!isMounted) return;
        setRecap(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("[WeeklyRecapWidget] Failed to load recap", error);
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [shouldRender, service, userId]);

  useEffect(() => {
    if (!recap || hasTracked.current) return;
    void trackAnalyticsEvent("weekly_recap_viewed", {
      week_start_date: recap.weekStartDate.toISOString(),
      total_runs: recap.totalRuns,
    }).catch((error) => {
      console.error("[WeeklyRecapWidget] Analytics error", error);
    });
    hasTracked.current = true;
  }, [recap]);

  const totalRuns = recap?.totalRuns ?? 0;
  const totalDistance = recap?.totalDistance ?? 0;
  const streakText = recap ? `🔥 ${recap.currentStreak} week streak` : "";
  const hasRuns = totalRuns > 0;
  const consistencyScore = recap?.consistencyScore ?? 0;
  const dailyCounts = useMemo(
    () => recap?.dailyRunTotals ?? Array.from({ length: 7 }, () => 0),
    [recap]
  );
  const maxDailyCount = Math.max(...dailyCounts, 1);

  const containerHeight = expanded ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0";

  const weekRange = recap
    ? `${format(recap.weekStartDate, "MMM d")} - ${format(recap.weekEndDate, "MMM d")}`
    : "";

  const distanceChange = recap?.weekOverWeekChange.distance ?? 0;
  const changeSign = distanceChange > 0 ? "+" : distanceChange < 0 ? "" : "";
  const changeArrow = distanceChange > 0 ? "↑" : distanceChange < 0 ? "↓" : "";

  const consistencyCircleStyle = {
    background: `conic-gradient(#14b8a6 ${consistencyScore * 3.6}deg, rgba(15,23,42,0.1) 0)`,
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      <Card className="border border-gray-200 bg-white shadow-sm mt-4">
        <CardContent className="p-0">
          <button
            type="button"
            className="flex items-center justify-between w-full px-4 py-3 text-left"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
          >
            <div>
              <p className="text-sm font-semibold text-gray-500">This Week&apos;s Progress 📊</p>
              <p className="text-lg font-semibold text-gray-900">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  `${totalRuns} runs • ${totalDistance}km`
                )}
              </p>
              {streakText && (
                <p className="text-xs font-medium text-amber-600">{streakText}</p>
              )}
            </div>
            <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
          </button>
          <div
            className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out px-4 ${containerHeight}`}
          >
            <div className="py-3 space-y-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching weekly metrics...
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-500">{weekRange}</div>
                  {hasRuns ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                          <p className="text-xs uppercase text-gray-500">Total distance</p>
                          <p className="text-2xl font-semibold text-gray-900">
                            {totalDistance.toFixed(1)} km
                          </p>
                          <Badge variant="secondary" className="mt-2 text-xs font-semibold">
                            {`${changeSign}${distanceChange}% ${changeArrow}`}
                          </Badge>
                        </div>
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                          <p className="text-xs uppercase text-gray-500">Total runs</p>
                          <p className="text-2xl font-semibold text-gray-900">{totalRuns}</p>
                          <p className="text-xs text-gray-500">
                            Week over week: {recap?.weekOverWeekChange.runs ?? 0}%
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                          <p className="text-xs uppercase text-gray-500">Average pace</p>
                          <p className="text-2xl font-semibold text-gray-900">
                            {recap?.averagePace ?? "--"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-700">Daily run count</p>
                          <BarLegend counts={recap?.dailyRunTotals ?? []} />
                        </div>
                        <div className="grid grid-cols-7 gap-2 h-24 items-end">
                          {dailyCounts.map((count, index) => {
                            const height =
                              maxDailyCount === 0 ? 6 : Math.max(6, (count / maxDailyCount) * 100);
                            return (
                              <div key={index} className="flex flex-col items-center text-[10px] text-gray-500 space-y-1">
                                <div
                                  className="w-full bg-slate-100 rounded-full transition-all duration-300"
                                  style={{ height: `${height}%` }}
                                >
                                  <div className="h-full rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500" />
                                </div>
                                <span className="text-xs">{dayLabels[index]}</span>
                                <span className="text-[10px] text-gray-400">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="relative flex items-center justify-center w-20 h-20 rounded-full"
                            style={consistencyCircleStyle}
                          >
                            <div className="absolute inset-2 rounded-full bg-white flex flex-col items-center justify-center">
                              <span className="text-lg font-semibold text-gray-900">
                                {consistencyScore}%
                              </span>
                              <span className="text-[10px] text-gray-500">consistency</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Consistency score</p>
                            <p className="text-xs text-gray-500">Runs completed / planned</p>
                          </div>
                        </div>

      <Button variant="outline" onClick={() => setModalOpen(true)}>
        View Full Recap
      </Button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                      No runs this week yet. Let&apos;s get moving! 🏃
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <WeeklyRecapModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        weeklyRecap={recap}
      />
    </>
  );
}

function BarLegend({ counts }: { counts: number[] }) {
  const total = counts.reduce((sum, value) => sum + value, 0);
  return (
    <div className="flex items-center gap-1 text-[10px] text-gray-500">
      <span>Weekly total:</span>
      <span className="font-semibold text-gray-900">{total}</span>
    </div>
  );
}

