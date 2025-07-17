'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';

interface PerformanceChartProps {
  title: string;
  data: Array<{ date: Date; [key: string]: any }>;
  dataKey: string;
  color: string;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
  showTrend?: boolean;
  height?: number;
}

export function PerformanceChart({ 
  title, 
  data, 
  dataKey, 
  color, 
  yAxisLabel, 
  formatValue,
  showTrend = true,
  height = 300 
}: PerformanceChartProps) {
  // Transform data for chart
  const chartData = data.map(item => ({
    ...item,
    date: new Date(item.date).getTime(),
    formattedDate: format(new Date(item.date), 'MMM dd'),
  }));

  // Calculate trend line
  const calculateTrend = () => {
    if (chartData.length < 2) return null;
    
    const n = chartData.length;
    const sumX = chartData.reduce((sum, item) => sum + item.date, 0);
    const sumY = chartData.reduce((sum, item) => sum + item[dataKey], 0);
    const sumXY = chartData.reduce((sum, item) => sum + item.date * item[dataKey], 0);
    const sumXX = chartData.reduce((sum, item) => sum + item.date * item.date, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  };

  const trend = showTrend ? calculateTrend() : null;

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{data.formattedDate}</p>
          <p className="text-sm" style={{ color }}>
            {yAxisLabel}: {formatValue ? formatValue(payload[0].value) : payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (value: number) => {
    if (formatValue) {
      return formatValue(value);
    }
    return value.toString();
  };

  // Calculate domain for better visualization
  const values = chartData.map(item => item[dataKey]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = (maxValue - minValue) * 0.1;
  const yDomain = [
    Math.max(0, minValue - padding),
    maxValue + padding
  ];

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {yAxisLabel && <CardDescription>{yAxisLabel}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis 
              dataKey="date"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
              className="text-xs"
            />
            <YAxis 
              domain={yDomain}
              tickFormatter={formatYAxis}
              className="text-xs"
            />
            <Tooltip content={customTooltip} />
            
            {/* Main data line */}
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2}
              dot={{ fill: color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: color }}
            />
            
            {/* Trend line */}
            {trend && showTrend && (
              <ReferenceLine
                segment={[
                  { x: chartData[0].date, y: trend.slope * chartData[0].date + trend.intercept },
                  { x: chartData[chartData.length - 1].date, y: trend.slope * chartData[chartData.length - 1].date + trend.intercept }
                ]}
                stroke={color}
                strokeDasharray="5 5"
                strokeOpacity={0.5}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        
        {/* Chart insights */}
        <div className="mt-4 flex justify-between text-sm text-gray-500">
          <span>
            {chartData.length} data points
          </span>
          {trend && (
            <span>
              Trend: {trend.slope > 0 ? '↗' : trend.slope < 0 ? '↘' : '→'} 
              {trend.slope > 0 ? ' Improving' : trend.slope < 0 ? ' Declining' : ' Stable'}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}