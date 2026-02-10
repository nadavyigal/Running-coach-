'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OverviewTab } from './components/OverviewTab'
import { FunnelsTab } from './components/FunnelsTab'
import { ABTestsTab } from './components/ABTestsTab'
import { CohortsTab } from './components/CohortsTab'
import { RetentionTab } from './components/RetentionTab'
import { JourneysTab } from './components/JourneysTab'
import { AnomaliesTab } from './components/AnomaliesTab'
import { ChurnTab } from './components/ChurnTab'

export default function AnalyticsDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">RunSmart Analytics</h1>
          <p className="text-gray-600">Production Dashboard - Phase 4</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="funnels">Funnels</TabsTrigger>
            <TabsTrigger value="ab-tests">A/B Tests</TabsTrigger>
            <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
            <TabsTrigger value="journeys">Journeys</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            <TabsTrigger value="churn">Churn</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="funnels">
            <FunnelsTab />
          </TabsContent>

          <TabsContent value="ab-tests">
            <ABTestsTab />
          </TabsContent>

          <TabsContent value="cohorts">
            <CohortsTab />
          </TabsContent>

          <TabsContent value="retention">
            <RetentionTab />
          </TabsContent>

          <TabsContent value="journeys">
            <JourneysTab />
          </TabsContent>

          <TabsContent value="anomalies">
            <AnomaliesTab />
          </TabsContent>

          <TabsContent value="churn">
            <ChurnTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
