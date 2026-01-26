'use client';

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { AiActivityAnalysisError, analyzeActivityImage } from '@/lib/ai-activity-client';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Upload,
} from 'lucide-react';
import { formatPace } from '@/lib/userDataValidation';
import { type HistoricRunEntry, type HistoricRunType } from '@/components/profile/types';

interface HistoricRunUploadModalProps {
  onClose: () => void;
  onSave: (run: HistoricRunEntry) => void;
  initialRun?: HistoricRunEntry;
}

const RUN_TYPE_OPTIONS: Array<{ value: HistoricRunType; label: string }> = [
  { value: 'easy', label: 'Easy' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'long', label: 'Long' },
  { value: 'intervals', label: 'Intervals' },
  { value: 'race', label: 'Race' },
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 6 * 1024 * 1024;

type Step = 'upload' | 'analyzing' | 'review' | 'error';

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

function parseDurationToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':').map((part) => part.trim());
  if (parts.length === 1) {
    const p0 = parts[0];
    if (!p0) return null;
    const minutes = Number.parseFloat(p0);
    if (!Number.isFinite(minutes)) return null;
    return Math.round(minutes * 60);
  }
  if (parts.length === 2) {
    const p0 = parts[0];
    const p1 = parts[1];
    if (!p0 || !p1) return null;
    const minutes = Number.parseInt(p0, 10);
    const seconds = Number.parseInt(p1, 10);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return null;
    return minutes * 60 + seconds;
  }
  if (parts.length === 3) {
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];
    if (!p0 || !p1 || !p2) return null;
    const hours = Number.parseInt(p0, 10);
    const minutes = Number.parseInt(p1, 10);
    const seconds = Number.parseInt(p2, 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    if (minutes >= 60 || seconds >= 60) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return null;
}

function normalizeRunType(value?: string): HistoricRunType | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (['easy', 'recovery', 'easyrun'].includes(cleaned)) return 'easy';
  if (['tempo', 'threshold', 'temp'].includes(cleaned)) return 'tempo';
  if (['long', 'longrun'].includes(cleaned)) return 'long';
  if (['interval', 'intervals', 'intervalsession'].includes(cleaned)) return 'intervals';
  if (['race', 'raceday', 'timetrial', 'tt'].includes(cleaned)) return 'race';
  return undefined;
}

function normalizeDate(value: Date) {
  const resolved = new Date(value);
  if (Number.isNaN(resolved.getTime())) {
    return new Date();
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (resolved > today) return today;
  return resolved;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date | null {
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function HistoricRunUploadModal({ onClose, onSave, initialRun }: HistoricRunUploadModalProps) {
  const [step, setStep] = useState<Step>(initialRun ? 'review' : 'upload');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(normalizeDate(new Date()));
  const [runType, setRunType] = useState<HistoricRunType>('easy');
  const [notes, setNotes] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!initialRun) return;
    setDistance(String(initialRun.distance));
    setDuration(formatDuration(initialRun.time));
    setSelectedDate(normalizeDate(initialRun.date));
    setRunType(initialRun.type ?? 'easy');
    setNotes(initialRun.notes ?? '');
    setConfidence(undefined);
    setStep('review');
  }, [initialRun]);

  const paceLabel = useMemo(() => {
    const distanceValue = Number.parseFloat(distance);
    const durationSeconds = parseDurationToSeconds(duration);
    if (!Number.isFinite(distanceValue) || distanceValue <= 0 || !durationSeconds || durationSeconds <= 0) {
      return '--:--';
    }
    return formatPace(durationSeconds / distanceValue);
  }, [distance, duration]);

  const handleFile = async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Unsupported file type. Please upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('File is too large. Please upload an image under 6MB.');
      return;
    }

    setError(null);
    setConfidence(undefined);
    setStep('analyzing');
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });

    try {
      const result = await analyzeActivityImage(file);
      const resolvedDate = result.completedAt ? normalizeDate(new Date(result.completedAt)) : normalizeDate(new Date());
      setDistance(String(result.distanceKm));
      setDuration(formatDuration(result.durationSeconds));
      setSelectedDate(resolvedDate);
      setRunType(normalizeRunType(result.type) ?? 'easy');
      setNotes(result.notes ?? '');
      setConfidence(result.confidence);
      setStep('review');
    } catch (err) {
      console.error('Historic run analysis failed:', err);
      const fallbackMessage =
        err instanceof AiActivityAnalysisError && err.errorCode === 'ai_missing_required_fields'
          ? `${err.message} We could not detect distance or duration clearly.`
          : err instanceof Error
            ? err.message
            : 'Unable to analyze the screenshot.';
      setError(fallbackMessage);
      setStep('error');
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void handleFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleConfirm = () => {
    const distanceValue = Number.parseFloat(distance);
    const durationSeconds = parseDurationToSeconds(duration);
    if (!Number.isFinite(distanceValue) || distanceValue <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid distance',
        description: 'Please enter a valid distance in kilometers.',
      });
      return;
    }
    if (!durationSeconds || durationSeconds <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid duration',
        description: 'Please enter a valid duration in mm:ss or h:mm:ss.',
      });
      return;
    }

    const trimmedNotes = notes.trim();
    onSave({
      distance: distanceValue,
      time: durationSeconds,
      date: selectedDate,
      type: runType,
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    });
  };

  return (
    <div className="fixed inset-0 z-[70] bg-neutral-950 text-white">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:text-white hover:bg-white/10"
            onClick={onClose}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">Historical Run</p>
            <h2 className="text-lg font-semibold">
              {initialRun ? 'Edit historical run' : 'Add historical run'}
            </h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                className={cn(
                  'rounded-3xl border border-dashed p-8 text-center transition',
                  isDragging ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-white/15 bg-white/[0.03]'
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  className="hidden"
                  onChange={handleFileInput}
                />
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                  <Upload className="h-5 w-5 text-white/70" />
                </div>
                <h3 className="text-base font-semibold">Upload a workout screenshot</h3>
                <p className="mt-2 text-sm text-white/50">
                  Drag and drop or click to browse. JPG, PNG, or WebP up to 6MB.
                </p>
              </div>
              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}
              <p className="text-xs text-white/40">
                Images are used only for analysis and discarded after review.
              </p>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-300" />
                <p className="mt-3 text-sm text-white/70">Analyzing your screenshot...</p>
              </div>
              {previewUrl && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <img src={previewUrl} alt="Upload preview" className="w-full rounded-2xl object-cover" />
                </div>
              )}
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-300" />
                  <div>
                    <h3 className="text-base font-semibold text-red-100">We could not read that screenshot</h3>
                    <p className="mt-2 text-sm text-red-200/80">{error ?? 'Please try another image.'}</p>
                  </div>
                </div>
              </div>
              {previewUrl && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <img src={previewUrl} alt="Upload preview" className="w-full rounded-2xl object-cover" />
                </div>
              )}
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => {
                    setError(null);
                    setConfidence(undefined);
                    setStep('upload');
                  }}
                >
                  Try a different image
                </Button>
                <Button
                  onClick={() => {
                    setError(null);
                    setConfidence(undefined);
                    setStep('review');
                  }}
                >
                  Enter details manually
                </Button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              {previewUrl ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <ImageIcon className="h-4 w-4" />
                      <span>Screenshot preview</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/60 hover:text-white hover:bg-white/10"
                      onClick={() => {
                        setConfidence(undefined);
                        setStep('upload');
                      }}
                    >
                      Replace
                    </Button>
                  </div>
                  <img src={previewUrl} alt="Upload preview" className="w-full rounded-2xl object-cover" />
                </div>
              ) : null}

              {typeof confidence === 'number' && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                  <div className="flex items-center gap-2">
                    {confidence >= 70 ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-300" />
                    )}
                    <span>AI confidence: {Math.round(confidence)}%</span>
                  </div>
                </div>
              )}

              <div className="grid gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Date
                  </Label>
                  <Input
                    type="date"
                    value={formatDateInput(selectedDate)}
                    max={formatDateInput(new Date())}
                    onChange={(event) => {
                      const parsed = parseDateInput(event.target.value);
                      if (parsed) setSelectedDate(normalizeDate(parsed));
                    }}
                    className="bg-white/[0.04] border-white/10 text-white focus-visible:ring-emerald-400/30 focus-visible:ring-offset-0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      Distance (km)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={distance}
                      onChange={(event) => setDistance(event.target.value)}
                      className="bg-white/[0.04] border-white/10 text-white focus-visible:ring-emerald-400/30 focus-visible:ring-offset-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      Duration (mm:ss)
                    </Label>
                    <Input
                      type="text"
                      placeholder="e.g., 42:30"
                      value={duration}
                      onChange={(event) => setDuration(event.target.value)}
                      className="bg-white/[0.04] border-white/10 text-white focus-visible:ring-emerald-400/30 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>

                <div className="text-xs text-white/50">Pace: {paceLabel}/km</div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Run type
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {RUN_TYPE_OPTIONS.map((option) => {
                      const active = runType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setRunType(option.value)}
                          className={cn(
                            'rounded-full px-4 py-2 text-sm font-medium border transition-all duration-200',
                            active
                              ? 'bg-emerald-400 text-neutral-950 border-emerald-400 shadow-lg shadow-emerald-500/25'
                              : 'bg-white/[0.03] text-white/70 border-white/10 hover:bg-white/[0.06] hover:text-white hover:border-white/20'
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Notes (optional)
                  </Label>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Add anything memorable about this run"
                    className="min-h-[90px] bg-white/[0.04] border-white/10 text-white focus-visible:ring-emerald-400/30 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-4">
          {step === 'review' ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleConfirm}>
                Save run
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
