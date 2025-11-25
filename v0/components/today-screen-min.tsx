"use client";

import { useEffect, useState } from "react";
import { type Plan, type Workout, type User } from "@/lib/db";
import { dbUtils } from "@/lib/dbUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function TodayScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [todaysWorkout, setTodaysWorkout] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const resolved = await dbUtils.getCurrentUser();
        if (!resolved || !resolved.id) {
          setError("No user available");
          return;
        }
        setUser(resolved);

        let active = await dbUtils.getActivePlan(resolved.id);
        if (!active) {
          active = await dbUtils.ensureUserHasActivePlan(resolved.id);
        }
        setPlan(active);

        const tw = await dbUtils.getTodaysWorkout(resolved.id);
        setTodaysWorkout(tw);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-green-500" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Training Plan</h1>
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="text-sm text-gray-600">
            {user ? (
              <span>
                Welcome back{user.experience ? ` (${user.experience})` : ""}!
              </span>
            ) : (
              <span>Welcome!</span>
            )}
          </div>
          {plan ? (
            <div className="text-gray-800">
              <div className="font-medium">Active Plan: {plan.title}</div>
              <div className="text-sm text-gray-600">Weeks: {plan.totalWeeks}</div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">Preparing your plan...</div>
          )}
          <div className="pt-2">
            <div className="font-semibold">Today's Workout</div>
            {todaysWorkout ? (
              <div className="text-sm text-gray-700">
                {todaysWorkout.day}: {todaysWorkout.type} — {todaysWorkout.distance} km
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                Rest day or no workout scheduled.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


