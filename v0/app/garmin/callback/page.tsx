"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db";

type CallbackStatus = "processing" | "success" | "error";

function GarminCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasProcessedRef = useRef(false);
  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [message, setMessage] = useState("Finalizing Garmin connection...");

  useEffect(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const code = searchParams.get("code");
    // Garmin may return state as "state" (standard OAuth 2.0) or "oauth_state" (Garmin variant)
    const state = searchParams.get("state") ?? searchParams.get("oauth_state");
    const oauthError = searchParams.get("error");

    const completeOAuth = async () => {
      if (oauthError) {
        setStatus("error");
        setMessage(`Garmin authorization failed: ${oauthError}`);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Missing OAuth parameters. Please reconnect Garmin from Settings.");
        return;
      }

      try {
        const response = await fetch("/api/devices/garmin/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ code, state }),
        });

        const data = await response.json();

        if (!response.ok || !data?.success) {
          const errorText = data?.error || "Garmin callback failed";
          throw new Error(errorText);
        }

        // Store device data in Dexie.js (client-side IndexedDB)
        // This PWA uses browser storage — the server handles only the OAuth secret exchange
        if (data.device && typeof data.userId === "number") {
          const { userId, device } = data as { userId: number; device: any };
          const existing = await db.wearableDevices
            .where({ userId, type: "garmin" })
            .first();
          if (existing?.id) {
            await db.wearableDevices.update(existing.id, {
              ...device,
              updatedAt: new Date(),
            });
          } else {
            await db.wearableDevices.add(device);
          }
        }

        setStatus("success");
        setMessage("Garmin connected. Redirecting...");

        setTimeout(() => {
          router.replace("/?screen=profile");
        }, 1200);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Garmin connection failed";
        setStatus("error");
        setMessage(errorMessage);
      }
    };

    void completeOAuth();
  }, [router, searchParams]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center p-6">
      <div className="w-full rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Garmin Connection</h1>
        <p className="mt-3 text-sm text-gray-700">{message}</p>

        {status === "processing" && (
          <p className="mt-4 text-sm text-gray-500">Please wait...</p>
        )}

        {status === "success" && (
          <p className="mt-4 text-sm text-green-700">Connection completed successfully.</p>
        )}

        {status === "error" && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-red-700">Connection could not be completed.</p>
            <Link href="/?screen=profile" className="inline-block text-sm font-medium text-blue-700 underline">
              Return to profile
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function GarminCallbackFallback() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center p-6">
      <div className="w-full rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Garmin Connection</h1>
        <p className="mt-3 text-sm text-gray-700">Finalizing Garmin connection...</p>
        <p className="mt-4 text-sm text-gray-500">Please wait...</p>
      </div>
    </main>
  );
}

export default function GarminCallbackPage() {
  return (
    <Suspense fallback={<GarminCallbackFallback />}>
      <GarminCallbackContent />
    </Suspense>
  );
}
