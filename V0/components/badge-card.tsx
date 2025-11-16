import { Badge as UIBadge } from "@/components/ui/badge";

export interface BadgeCardProps {
  type: 'bronze' | 'silver' | 'gold';
  milestone: number;
  unlockedAt: Date;
  streakValueAchieved?: number;
}

const badgeIcons = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
};

const badgeColors = {
  bronze: 'bg-yellow-900 text-yellow-200',
  silver: 'bg-gray-400 text-gray-900',
  gold: 'bg-yellow-400 text-yellow-900',
};

export function BadgeCard({ type, milestone, unlockedAt, streakValueAchieved }: BadgeCardProps) {
  return (
    <div className={`flex flex-col items-center p-3 rounded-lg border ${badgeColors[type]}`}
      title={`Unlocked at ${milestone}-day streak${streakValueAchieved ? ` (achieved at ${streakValueAchieved})` : ''}`}>
      <div className="text-3xl mb-1">{badgeIcons[type]}</div>
      <UIBadge variant="outline" className="mb-1 capitalize">{type} badge</UIBadge>
      <div className="text-xs font-medium">{milestone}-day streak</div>
      <div className="text-xs text-gray-700 mt-1">{unlockedAt instanceof Date ? unlockedAt.toLocaleDateString() : unlockedAt}</div>
      {typeof streakValueAchieved === 'number' && (
        <div className="sr-only">Achieved at streak value: {streakValueAchieved}</div>
      )}
    </div>
  );
} 
