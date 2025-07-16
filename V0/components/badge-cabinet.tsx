'use client';

import { useEffect, useState } from "react";
import { dbUtils, Badge } from "@/lib/db";
import { BadgeCard } from "@/components/badge-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShareBadgeModal } from "@/components/share-badge-modal";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";

export function BadgeCabinet({ userId }: { userId: number }) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    dbUtils.getUserBadges(userId).then(b => {
      if (mounted) {
        setBadges(b);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [userId]);

  const handleShareClick = (badgeId: string, badgeName: string) => {
    setSelectedBadge({ id: badgeId, name: badgeName });
    setIsShareModalOpen(true);
  };

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
    setSelectedBadge(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-2xl font-bold">Badge Cabinet</CardTitle>
        {badges.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => handleShareClick("all-badges", "All Badges")}>
            <Share2 className="mr-2 h-4 w-4" /> Share All
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-gray-500">Loading badges...</div>
        ) : badges.length === 0 ? (
          <div className="text-center text-gray-400">No badges earned yet. Start a streak to unlock your first badge!</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {badges.map(badge => (
              <div key={badge.id} className="relative group">
                <BadgeCard {...badge} />
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleShareClick(badge.id.toString(), badge.name)}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {selectedBadge && (
        <ShareBadgeModal
          badgeId={selectedBadge.id}
          badgeName={selectedBadge.name}
          isOpen={isShareModalOpen}
          onClose={handleCloseShareModal}
        />
      )}
    </Card>
  );
} 