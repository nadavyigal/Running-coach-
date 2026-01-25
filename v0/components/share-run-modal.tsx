"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Copy, Share2, MessageCircle, Facebook, Twitter } from "lucide-react";
import { useState, useEffect } from "react";
import { dbUtils } from "@/lib/dbUtils";
import type { Run } from "@/lib/db";
import { calculateSegmentPaces, downsamplePaceData, smoothPaceData, type GPSPoint, type PaceData } from "@/lib/pace-calculations";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { ENABLE_PACE_CHART } from "@/lib/featureFlags";
import { useToast } from "@/hooks/use-toast";

interface ShareRunModalProps {
  runId: string;
  runDate: string;
  isOpen: boolean;
  onClose: () => void;
}

const SHARE_SNAPSHOT_TITLE = "My Run";
const MAX_SNAPSHOT_POINTS = 200;

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatPace = (secondsPerKm: number) => {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "--:--";
  const mins = Math.floor(secondsPerKm / 60);
  const secs = Math.round(secondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parsePaceGpsPath = (gpsPath?: string): GPSPoint[] => {
  if (!gpsPath) return [];
  try {
    const parsed = JSON.parse(gpsPath);
    if (!Array.isArray(parsed)) return [];

    const normalized: GPSPoint[] = [];
    for (const point of parsed) {
      if (!point || typeof point !== "object") continue;
      const record = point as Record<string, unknown>;
      const lat =
        typeof record.lat === "number"
          ? record.lat
          : typeof record.latitude === "number"
            ? record.latitude
            : null;
      const lng =
        typeof record.lng === "number"
          ? record.lng
          : typeof record.longitude === "number"
            ? record.longitude
            : null;
      const timestamp =
        typeof record.timestamp === "number" && Number.isFinite(record.timestamp)
          ? record.timestamp
          : null;

      if (lat === null || lng === null || timestamp === null) continue;
      normalized.push({
        lat,
        lng,
        timestamp,
        ...(typeof record.accuracy === "number" ? { accuracy: record.accuracy } : {}),
      });
    }
    return normalized;
  } catch {
    return [];
  }
};

const buildPaceChartSVG = (paceData: PaceData[]): string => {
  if (!paceData.length) {
    return `<svg viewBox="0 0 600 200" width="100%" height="200" role="img" aria-label="Pace chart"><rect width="600" height="200" fill="#f8fafc"/><text x="300" y="108" fill="#64748b" font-size="14" text-anchor="middle">Pace data unavailable</text></svg>`;
  }

  const width = 600;
  const height = 200;
  const padding = 24;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  // Use time-based X-axis for consistency with main chart
  const startTime = paceData[0]?.timestamp.getTime() ?? 0;
  const maxTimeMs = (paceData[paceData.length - 1]?.timestamp.getTime() ?? 0) - startTime;
  const paces = paceData.map((entry) => entry.paceMinPerKm);
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const paceRange = Math.max(0.1, maxPace - minPace);

  const scaleX = (timestamp: Date) => {
    const elapsedMs = timestamp.getTime() - startTime;
    return padding + (maxTimeMs > 0 ? (elapsedMs / maxTimeMs) * plotWidth : 0);
  };
  const scaleY = (paceMinPerKm: number) =>
    padding + (1 - (paceMinPerKm - minPace) / paceRange) * plotHeight;

  const pathD = paceData
    .map((entry, index) => `${index === 0 ? "M" : "L"} ${scaleX(entry.timestamp)} ${scaleY(entry.paceMinPerKm)}`)
    .join(" ");

  // Create area path for gradient fill
  const firstPoint = paceData[0];
  const lastPoint = paceData[paceData.length - 1];
  const plotBottom = height - padding;
  const areaPathD = firstPoint && lastPoint
    ? `${pathD} L ${scaleX(lastPoint.timestamp)} ${plotBottom} L ${scaleX(firstPoint.timestamp)} ${plotBottom} Z`
    : "";

  return `
<svg viewBox="0 0 600 200" width="100%" height="200" role="img" aria-label="Pace chart">
  <defs>
    <linearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <rect width="600" height="200" fill="#f8fafc"/>
  ${areaPathD ? `<path d="${areaPathD}" fill="url(#paceGradient)"/>` : ""}
  <path d="${pathD}" fill="none" stroke="#2563eb" stroke-width="2"/>
</svg>`.trim();
};

const extractInsightSummary = (runReport?: string): string[] => {
  if (!runReport) return [];
  try {
    const parsed = JSON.parse(runReport);
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.summary)) {
        return parsed.summary.filter((item: unknown) => typeof item === "string").slice(0, 2);
      }
      if (typeof parsed.shortSummary === "string") {
        const positives = Array.isArray(parsed.positives)
          ? parsed.positives.filter((item: unknown) => typeof item === "string")
          : [];
        return [parsed.shortSummary, positives[0]].filter(Boolean) as string[];
      }
    }
  } catch {
    return [];
  }
  return [];
};

const generateHTMLSnapshot = (run: Run, paceChartSVG: string): string => {
  const avgPaceSeconds = run.pace ?? (run.distance > 0 ? run.duration / run.distance : 0);
  const insights = extractInsightSummary(run.runReport);
  const dateLabel = run.completedAt
    ? new Date(run.completedAt).toLocaleDateString()
    : "Unknown date";
  const stats = [
    { label: "Distance", value: `${run.distance.toFixed(2)} km` },
    { label: "Duration", value: formatDuration(run.duration) },
    { label: "Pace", value: `${formatPace(avgPaceSeconds)}/km` },
    { label: "Date", value: dateLabel },
  ];

  const insightItems = insights.length
    ? insights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : `<li>Solid work getting the run done.</li>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Run Snapshot</title>
    <style>
      body { margin: 0; font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; background: #f1f5f9; color: #0f172a; }
      .container { max-width: 720px; margin: 0 auto; padding: 24px; }
      .card { background: #ffffff; border-radius: 16px; padding: 20px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
      h1 { font-size: 22px; margin: 0 0 8px; }
      .subtitle { color: #475569; font-size: 14px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      td { padding: 8px 0; font-size: 14px; }
      td.label { color: #64748b; width: 30%; }
      .chart { border-radius: 12px; overflow: hidden; background: #f8fafc; margin-bottom: 16px; }
      .insights { margin: 0; padding-left: 18px; color: #334155; }
      .footer { margin-top: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <h1>Run Snapshot</h1>
        <div class="subtitle">Here is your latest run summary.</div>
        <table>
          ${stats
            .map(
              (item) =>
                `<tr><td class="label">${escapeHtml(item.label)}</td><td>${escapeHtml(item.value)}</td></tr>`
            )
            .join("")}
        </table>
        <div class="chart">${paceChartSVG}</div>
        <h2 style="font-size:16px;margin:0 0 8px;">AI Insights</h2>
        <ul class="insights">${insightItems}</ul>
      </div>
      <div class="footer">Shared from Run-Smart</div>
    </div>
  </body>
</html>`;
};

export function ShareRunModal({
  runId,
  runDate,
  isOpen,
  onClose,
}: ShareRunModalProps) {
  const [shareableLink, setShareableLink] = useState("");
  const [shareableContent, setShareableContent] = useState<any>(null);
  const [socialShareUrls, setSocialShareUrls] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await dbUtils.getCurrentUser();
        setCurrentUserId(user?.id || null);
      } catch (error) {
        console.error('Failed to load current user:', error);
        setError('Failed to load user information');
      }
    };
    if (isOpen) {
      loadCurrentUser();
    }
  }, [isOpen]);

  const generateShareLink = async () => {
    if (!currentUserId) {
      setError('User not loaded. Please try again.');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/share-run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ runId, userId: currentUserId.toString() }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate shareable link.");
      }

      const data = await response.json();
      setShareableLink(data.shareableLink);
      setShareableContent(data.shareableContent);
      setSocialShareUrls(data.socialShareUrls);
    } catch (err) {
      setError("Could not generate share link. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (shareableLink) {
      try {
        await navigator.clipboard.writeText(shareableLink);
        toast({
          title: "Link copied!",
          description: "Share link copied to clipboard",
        });
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        toast({
          title: "Copy failed",
          description: "Failed to copy link to clipboard",
          variant: "destructive",
        });
      }
    }
  };

  const handleSocialShare = (platform: string, url: string) => {
    window.open(url, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
  };

  const handleNativeShare = async () => {
    if (navigator.share && shareableContent) {
      try {
        await navigator.share({
          title: shareableContent.title,
          text: shareableContent.description,
          url: shareableLink,
        });
        await trackAnalyticsEvent("run_report_shared", { share_method: "native_share" });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback to copying link if Web Share API is not available
      copyToClipboard();
    }
  };

  const buildShareText = (run: Run, insightSummary: string) => {
    const avgPaceSeconds = run.pace ?? (run.distance > 0 ? run.duration / run.distance : 0);
    return `I just ran ${run.distance.toFixed(2)}km in ${formatDuration(run.duration)} at ${formatPace(avgPaceSeconds)} pace! 🏃
${insightSummary}

View full report: ${shareableLink}`;
  };

  const handleSnapshotShare = async () => {
    if (!ENABLE_PACE_CHART) return;
    if (!shareableLink) {
      toast({
        title: "Generate the share link first",
        description: "Create a shareable link before sharing the snapshot.",
      });
      return;
    }

    setSnapshotLoading(true);
    try {
      const run = await dbUtils.getRunById(Number(runId));
      if (!run) {
        throw new Error("Run not found.");
      }

      const pacePoints = parsePaceGpsPath(run.gpsPath);
      const rawPaceData = calculateSegmentPaces(pacePoints);
      const paceData = downsamplePaceData(smoothPaceData(rawPaceData, 3), MAX_SNAPSHOT_POINTS);
      const paceChartSVG = buildPaceChartSVG(paceData);
      const snapshotHtml = generateHTMLSnapshot(run, paceChartSVG);
      const insights = extractInsightSummary(run.runReport);
      const insightSummary = insights[0] || "Feeling strong and staying consistent.";
      const shareText = buildShareText(run, insightSummary);

      if (navigator.share) {
        await navigator.share({
          title: SHARE_SNAPSHOT_TITLE,
          text: shareText,
          url: shareableLink,
        });
        await trackAnalyticsEvent("run_report_shared", { share_method: "native_share" });
        return;
      }

      await navigator.clipboard.writeText(snapshotHtml);
      toast({
        title: "Snapshot copied!",
        description: "HTML snapshot copied to clipboard.",
      });
      await trackAnalyticsEvent("run_report_shared", { share_method: "clipboard" });
    } catch (error) {
      console.error("Failed to share snapshot:", error);
      toast({
        title: "Snapshot failed",
        description: "Unable to generate the HTML snapshot.",
        variant: "destructive",
      });
    } finally {
      setSnapshotLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Share Your Run from {runDate}!</AlertDialogTitle>
          <AlertDialogDescription>
            Share your run summary with friends and on social media.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
          <Button onClick={generateShareLink} disabled={loading || !!shareableLink}>
            {loading ? "Generating..." : shareableLink ? "Link Generated!" : "Generate Share Link"}
          </Button>
          {shareableLink && (
            <div className="grid gap-2">
              <Label htmlFor="share-link">Shareable Link</Label>
              <div className="flex space-x-2">
                <Input id="share-link" value={shareableLink} readOnly />
                <Button type="button" size="sm" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                  <span className="sr-only">Copy link</span>
                </Button>
              </div>
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {shareableLink && shareableContent && (
            <div className="space-y-4 mt-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">{shareableContent.title}</h4>
                <p className="text-sm text-muted-foreground mb-2">{shareableContent.description}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Distance: {shareableContent.distance}km</span>
                  <span>Duration: {shareableContent.duration}m</span>
                  <span>Pace: {shareableContent.pace}/km</span>
                </div>
              </div>
              
              <div className="flex justify-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNativeShare}
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>

                {ENABLE_PACE_CHART && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSnapshotShare}
                    className="flex items-center gap-2"
                    disabled={snapshotLoading}
                  >
                    {snapshotLoading ? "Preparing..." : "Share as Snapshot"}
                  </Button>
                )}
                
                {socialShareUrls && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSocialShare('twitter', socialShareUrls.twitter)}
                      className="flex items-center gap-2"
                    >
                      <Twitter className="h-4 w-4" />
                      Twitter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSocialShare('facebook', socialShareUrls.facebook)}
                      className="flex items-center gap-2"
                    >
                      <Facebook className="h-4 w-4" />
                      Facebook
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSocialShare('whatsapp', socialShareUrls.whatsapp)}
                      className="flex items-center gap-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
