"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Share2 } from "lucide-react";
import { useState } from "react";

interface ShareBadgeModalProps {
  badgeId: string;
  badgeName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareBadgeModal({
  badgeId,
  badgeName,
  isOpen,
  onClose,
}: ShareBadgeModalProps) {
  const [shareableLink, setShareableLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateShareLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/share-badge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ badgeId, userId: "current_user_id" }), // TODO: Replace with actual user ID
      });

      if (!response.ok) {
        throw new Error("Failed to generate shareable link.");
      }

      const data = await response.json();
      setShareableLink(data.shareableLink);
    } catch (err) {
      setError("Could not generate share link. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (shareableLink) {
      navigator.clipboard.writeText(shareableLink);
      // Optionally, show a toast notification
      alert("Link copied to clipboard!");
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Share Your {badgeName} Badge!</AlertDialogTitle>
          <AlertDialogDescription>
            Share your awesome achievement with friends and on social media.
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
          {shareableLink && (
            <div className="flex justify-center space-x-4 mt-4">
              {/* TODO: Implement actual social media sharing buttons */}
              <Button variant="outline" size="icon" onClick={() => alert("Twitter share not implemented")}>
                <Share2 className="h-5 w-5" />
                <span className="sr-only">Share on Twitter</span>
              </Button>
              <Button variant="outline" size="icon" onClick={() => alert("Facebook share not implemented")}>
                <Share2 className="h-5 w-5" />
                <span className="sr-only">Share on Facebook</span>
              </Button>
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
