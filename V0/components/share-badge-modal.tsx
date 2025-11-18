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
import { toast } from "@/components/ui/use-toast";
import { Copy, Share2, Twitter, Facebook } from "lucide-react";
import { useState, useEffect } from "react";
import { dbUtils } from "@/lib/dbUtils";

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
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Get current user ID when component mounts
  useEffect(() => {
    const getCurrentUserId = async () => {
      try {
        const user = await dbUtils.getCurrentUser();
        if (user?.id) {
          setCurrentUserId(user.id);
        } else {
          setError("No user found. Please complete onboarding first.");
        }
      } catch (err) {
        console.error("Failed to get current user:", err);
        setError("Failed to get user information.");
      }
    };

    if (isOpen) {
      getCurrentUserId();
    }
  }, [isOpen]);

  const generateShareLink = async () => {
    if (!currentUserId) {
      setError("User not found. Please try again.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/share-badge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ badgeId, userId: currentUserId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate shareable link.");
      }

      const data = await response.json();
      setShareableLink(data.shareableLink);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not generate share link. Please try again.";
      setError(errorMessage);
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
          title: "Copied!",
          description: "Share link copied to clipboard.",
        });
      } catch (err) {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = shareableLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        toast({
          title: "Copied!",
          description: "Share link copied to clipboard.",
        });
      }
    }
  };

  const shareOnTwitter = () => {
    if (shareableLink) {
      const text = encodeURIComponent(`🏃‍♂️ I just earned the ${badgeName} badge! Check out my running achievement: ${shareableLink} #RunSmart #Running #Fitness`);
      window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'width=550,height=420');
    }
  };

  const shareOnFacebook = () => {
    if (shareableLink) {
      const url = encodeURIComponent(shareableLink);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=550,height=420');
    }
  };

  const shareViaWebAPI = async () => {
    if (navigator.share && shareableLink) {
      try {
        await navigator.share({
          title: `${badgeName} Badge Achievement`,
          text: `I just earned the ${badgeName} badge in RunSmart!`,
          url: shareableLink,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
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
            <div className="flex justify-center space-x-3 mt-4">
              <Button variant="outline" size="sm" onClick={shareOnTwitter}>
                <Twitter className="h-4 w-4 mr-2" />
                Twitter
              </Button>
              <Button variant="outline" size="sm" onClick={shareOnFacebook}>
                <Facebook className="h-4 w-4 mr-2" />
                Facebook
              </Button>
              {navigator.share && (
                <Button variant="outline" size="sm" onClick={shareViaWebAPI}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              )}
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
