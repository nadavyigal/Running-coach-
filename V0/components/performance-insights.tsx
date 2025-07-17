'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Lightbulb,
  Target,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface PerformanceInsight {
  id?: number;
  type: 'improvement' | 'warning' | 'achievement' | 'recommendation' | 'info';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  createdAt: Date;
  validUntil?: Date;
}

interface PerformanceInsightsProps {
  insights: PerformanceInsight[];
}

export function PerformanceInsights({ insights }: PerformanceInsightsProps) {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'improvement':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'achievement':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'recommendation':
        return <Lightbulb className="h-4 w-4 text-purple-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-gray-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'improvement':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'achievement':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'recommendation':
        return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
      case 'info':
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium Priority</Badge>;
      case 'low':
        return <Badge variant="outline">Low Priority</Badge>;
      default:
        return <Badge variant="outline">Normal</Badge>;
    }
  };

  const sortedInsights = [...insights].sort((a, b) => {
    // Sort by priority first (high > medium > low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by creation date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const actionableInsights = sortedInsights.filter(insight => insight.actionable);
  const informationalInsights = sortedInsights.filter(insight => !insight.actionable);

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Performance Insights
          </CardTitle>
          <CardDescription>AI-powered analysis of your running performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="flex justify-center mb-4">
              <Target className="h-12 w-12 text-gray-300" />
            </div>
            <p className="text-gray-500 mb-2">No insights available yet</p>
            <p className="text-sm text-gray-400">
              Complete more runs to get personalized performance insights
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Performance Insights
        </CardTitle>
        <CardDescription>
          AI-powered analysis of your running performance ({insights.length} insights)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Actionable Insights */}
          {actionableInsights.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Actionable Recommendations
              </h4>
              <div className="space-y-3">
                {actionableInsights.map((insight, index) => (
                  <div
                    key={insight.id || index}
                    className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getInsightIcon(insight.type)}
                        <h5 className="font-medium">{insight.title}</h5>
                      </div>
                      {getPriorityBadge(insight.priority)}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {insight.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {format(new Date(insight.createdAt), 'MMM dd, yyyy')}
                      </div>
                      {insight.actionable && (
                        <Button variant="outline" size="sm">
                          Take Action
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Informational Insights */}
          {informationalInsights.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Performance Updates
              </h4>
              <div className="space-y-3">
                {informationalInsights.map((insight, index) => (
                  <div
                    key={insight.id || index}
                    className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getInsightIcon(insight.type)}
                        <h5 className="font-medium">{insight.title}</h5>
                      </div>
                      {getPriorityBadge(insight.priority)}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {insight.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      {format(new Date(insight.createdAt), 'MMM dd, yyyy')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="pt-4 border-t">
            <div className="flex justify-between text-sm text-gray-500">
              <span>
                {actionableInsights.length} actionable • {informationalInsights.length} informational
              </span>
              <span>
                Last updated: {format(new Date(Math.max(...insights.map(i => new Date(i.createdAt).getTime()))), 'MMM dd')}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}