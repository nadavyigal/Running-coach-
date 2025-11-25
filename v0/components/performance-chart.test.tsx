import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformanceChart } from './performance-chart';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback: any) {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Recharts
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: ({ stroke, dataKey }: any) => (
    <div data-testid="line" data-stroke={stroke} data-datakey={dataKey} />
  ),
  XAxis: ({ tickFormatter }: any) => <div data-testid="x-axis" />,
  YAxis: ({ tickFormatter }: any) => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }: any) => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  ReferenceLine: ({ stroke, strokeDasharray }: any) => (
    <div data-testid="reference-line" data-stroke={stroke} data-stroke-dasharray={strokeDasharray} />
  ),
}));

const mockData = [
  { date: new Date('2023-11-01'), pace: 360 },
  { date: new Date('2023-11-15'), pace: 350 },
  { date: new Date('2023-12-01'), pace: 340 },
];

describe('PerformanceChart', () => {
  it('renders chart with data', () => {
    render(
      <PerformanceChart
        title="Pace Progression"
        data={mockData}
        dataKey="pace"
        color="#3b82f6"
        yAxisLabel="Pace (sec/km)"
      />
    );

    expect(screen.getByText('Pace Progression')).toBeInTheDocument();
    expect(screen.getByText('Pace (sec/km)')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('shows no data message when data is empty', () => {
    render(
      <PerformanceChart
        title="Empty Chart"
        data={[]}
        dataKey="pace"
        color="#3b82f6"
      />
    );

    expect(screen.getByText('Empty Chart')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders with custom format value function', () => {
    const formatValue = (value: number) => `${value.toFixed(1)} km`;
    
    render(
      <PerformanceChart
        title="Distance Chart"
        data={mockData}
        dataKey="pace"
        color="#10b981"
        formatValue={formatValue}
      />
    );

    expect(screen.getByText('Distance Chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders without trend line when showTrend is false', () => {
    render(
      <PerformanceChart
        title="No Trend Chart"
        data={mockData}
        dataKey="pace"
        color="#f59e0b"
        showTrend={false}
      />
    );

    expect(screen.getByText('No Trend Chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('reference-line')).not.toBeInTheDocument();
  });

  it('renders trend line by default', () => {
    render(
      <PerformanceChart
        title="Trend Chart"
        data={mockData}
        dataKey="pace"
        color="#8b5cf6"
      />
    );

    expect(screen.getByText('Trend Chart')).toBeInTheDocument();
    expect(screen.getByTestId('reference-line')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(
      <PerformanceChart
        title="Custom Height Chart"
        data={mockData}
        dataKey="pace"
        color="#3b82f6"
        height={400}
      />
    );

    expect(screen.getByText('Custom Height Chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('shows chart insights', () => {
    render(
      <PerformanceChart
        title="Insights Chart"
        data={mockData}
        dataKey="pace"
        color="#3b82f6"
      />
    );

    expect(screen.getByText('3 data points')).toBeInTheDocument();
    expect(screen.getByText('Trend: ↘ Declining')).toBeInTheDocument();
  });

  it('shows correct color for line and trend', () => {
    const color = '#ff0000';
    
    render(
      <PerformanceChart
        title="Color Chart"
        data={mockData}
        dataKey="pace"
        color={color}
      />
    );

    const line = screen.getByTestId('line');
    expect(line).toHaveAttribute('data-stroke', color);
    
    const trendLine = screen.getByTestId('reference-line');
    expect(trendLine).toHaveAttribute('data-stroke', color);
  });

  it('handles single data point', () => {
    const singlePointData = [{ date: new Date('2023-11-01'), pace: 360 }];
    
    render(
      <PerformanceChart
        title="Single Point"
        data={singlePointData}
        dataKey="pace"
        color="#3b82f6"
      />
    );

    expect(screen.getByText('Single Point')).toBeInTheDocument();
    expect(screen.getByText('1 data points')).toBeInTheDocument();
    expect(screen.getByText('Trend: → Stable')).toBeInTheDocument();
  });

  it('formats data correctly for chart', () => {
    const dataWithDifferentTypes = [
      { date: new Date('2023-11-01'), value: 100 },
      { date: new Date('2023-11-15'), value: 200 },
    ];
    
    render(
      <PerformanceChart
        title="Value Chart"
        data={dataWithDifferentTypes}
        dataKey="value"
        color="#3b82f6"
        yAxisLabel="Value"
      />
    );

    expect(screen.getByText('Value Chart')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('2 data points')).toBeInTheDocument();
  });

  it('shows improving trend for upward data', () => {
    const improvingData = [
      { date: new Date('2023-11-01'), value: 100 },
      { date: new Date('2023-11-15'), value: 150 },
      { date: new Date('2023-12-01'), value: 200 },
    ];
    
    render(
      <PerformanceChart
        title="Improving Chart"
        data={improvingData}
        dataKey="value"
        color="#3b82f6"
      />
    );

    expect(screen.getByText('Improving Chart')).toBeInTheDocument();
    expect(screen.getByText('Trend: ↗ Improving')).toBeInTheDocument();
  });
});