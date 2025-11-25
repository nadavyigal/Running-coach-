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
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Copy, Share2, MessageCircle, Facebook, Linkedin, Twitter } from "lucide-react";
import { useState, useEffect } from "react";
import { dbUtils } from "@/lib/dbUtils";
import { useToast } from "@/hooks/use-toast";

interface ShareRunModalProps {
  runId: string;
  runDate: string;
  isOpen: boolean;
  onClose: () => void;
}

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
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback to copying link if Web Share API is not available
      copyToClipboard();
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
