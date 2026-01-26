'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPace } from '@/lib/userDataValidation';
import { cn } from '@/lib/utils';
import { Pencil, Trash2 } from 'lucide-react';
import { type HistoricRunEntry, type HistoricRunType } from '@/components/profile/types';

interface HistoricRunCardProps {
  run: HistoricRunEntry;
  onEdit: () => void;
  onDelete: () => void;
}

const RUN_TYPE_LABELS: Record<HistoricRunType, string> = {
  easy: 'Easy',
  tempo: 'Tempo',
  long: 'Long',
  intervals: 'Intervals',
  race: 'Race',
};

function formatDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

function formatDistance(distance: number) {
  if (!Number.isFinite(distance)) return '--';
  const normalized = distance.toFixed(2);
  return normalized.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function formatTypeLabel(value: string) {
  const cleaned = value.replace(/_/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function HistoricRunCard({ run, onEdit, onDelete }: HistoricRunCardProps) {
  const distanceLabel = formatDistance(run.distance);
  const paceSeconds = run.distance > 0 ? run.time / run.distance : undefined;
  const paceLabel = paceSeconds ? formatPace(paceSeconds) : '--:--';
  const typeLabel = run.type ? RUN_TYPE_LABELS[run.type] ?? formatTypeLabel(run.type) : undefined;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-medium text-white">
            {distanceLabel} km in {formatDuration(run.time)}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
            <span>{formatDate(run.date)}</span>
            <span className="text-white/30">•</span>
            <span>{paceLabel}/km</span>
            {typeLabel && (
              <Badge
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide bg-white/10 text-white/80 border border-white/10'
                )}
              >
                {typeLabel}
              </Badge>
            )}
          </div>
          {run.notes && <p className="text-xs text-white/50">{run.notes}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
