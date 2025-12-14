'use client';

import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';

const PerformanceChart = dynamic(() => import('@/components/performance-chart').then(mod => mod.PerformanceChart), {
  ssr: false,
  loading: () => (
    <Card>
      <div className="p-6 text-sm text-gray-600">Loading chart…</div>
    </Card>
  ),
});

interface TrendsProps {
  paceProgression: Array<{ date: Date; pace: number }>;
  distanceProgression: Array<{ date: Date; distance: number }>;
  consistencyProgression: Array<{ date: Date; consistency: number }>;
}

export function PerformanceTrendsTab({
  paceProgression,
  distanceProgression,
  consistencyProgression,
}: TrendsProps) {
  const formatPace = (value: number) => {
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PerformanceChart
          title="Pace Progression"
          data={paceProgression}
          dataKey="pace"
          color="#10b981"
          yAxisLabel="Pace (sec/km)"
          formatValue={formatPace}
        />
        <PerformanceChart
          title="Distance Progression"
          data={distanceProgression}
          dataKey="distance"
          color="#f59e0b"
          yAxisLabel="Distance (km)"
          formatValue={(value) => `${value.toFixed(1)} km`}
        />
      </div>
      <PerformanceChart
        title="Consistency Score"
        data={consistencyProgression}
        dataKey="consistency"
        color="#8b5cf6"
        yAxisLabel="Consistency (%)"
        formatValue={(value) => `${value.toFixed(0)}%`}
      />
    </div>
  );
}
