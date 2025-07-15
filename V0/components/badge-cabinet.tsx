import { useEffect, useState } from "react";
import { dbUtils, Badge } from "@/lib/db";
import { BadgeCard } from "@/components/badge-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function BadgeCabinet({ userId }: { userId: number }) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Badge Cabinet</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-gray-500">Loading badges...</div>
        ) : badges.length === 0 ? (
          <div className="text-center text-gray-400">No badges earned yet. Start a streak to unlock your first badge!</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {badges.map(badge => (
              <BadgeCard key={badge.id} {...badge} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 