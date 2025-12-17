'use client';

import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { PerformanceInsights } from '@/components/performance-insights';

const PerformanceChart = dynamic(() => import('@/components/performance-chart').then(mod => mod.PerformanceChart), {
  ssr: false,
  loading: () => (
    <Card>
      <div className="p-6 text-sm text-gray-600">Loading chart…</div>
    </Card>
  ),
});

interface OverviewProps {
  performanceProgression: Array<{ date: Date; performance: number }>;
  insights: any[];
}

export function PerformanceOverviewTab({ performanceProgression, insights }: OverviewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PerformanceChart
        title="Performance Trends"
        data={performanceProgression}
        dataKey="performance"
        color="#3b82f6"
        yAxisLabel="Performance Score (%)"
      />
      <PerformanceInsights insights={insights} />
    </div>
  );
}
