'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle, RefreshCw, Trash2, Settings, Eye } from 'lucide-react'
import { 
  diagnoseOnboardingState, 
  resetOnboardingState, 
  autoFixOnboardingState, 
  logDiagnosticReport,
  type OnboardingDiagnosticReport 
} from '@/lib/onboardingDiagnostics'

interface OnboardingDebugPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function OnboardingDebugPanel({ isOpen, onClose }: OnboardingDebugPanelProps) {
  const [report, setReport] = useState<OnboardingDiagnosticReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastAction, setLastAction] = useState<string>('')

  if (!isOpen) return null

  const handleDiagnose = async () => {
    setLoading(true)
    try {
      const diagnosticReport = await diagnoseOnboardingState()
      setReport(diagnosticReport)
      logDiagnosticReport(diagnosticReport)
      setLastAction('Diagnostic completed')
    } catch (error) {
      console.error('Diagnostic failed:', error)
      setLastAction(`Diagnostic failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      const result = await resetOnboardingState()
      if (result.success) {
        setLastAction('Onboarding state reset successfully')
        setReport(null) // Clear old report
      } else {
        setLastAction(`Reset failed: ${result.error}`)
      }
    } catch (error) {
      setLastAction(`Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAutoFix = async () => {
    setLoading(true)
    try {
      const result = await autoFixOnboardingState()
      if (result.success) {
        setLastAction(`Auto-fix completed: ${result.action}`)
        // Re-run diagnosis after fix
        await handleDiagnose()
      } else {
        setLastAction(`Auto-fix failed: ${result.error}`)
      }
    } catch (error) {
      setLastAction(`Auto-fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (hasConflict: boolean) => {
    return hasConflict ? (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Conflict Detected
      </Badge>
    ) : (
      <Badge variant="default" className="gap-1">
        <CheckCircle className="h-3 w-3" />
        Normal State
      </Badge>
    )
  }

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'reset_all':
        return 'text-red-600'
      case 'complete_onboarding':
        return 'text-yellow-600'
      case 'migrate_data':
        return 'text-blue-600'
      default:
        return 'text-green-600'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Onboarding Debug Panel
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleDiagnose} 
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <Eye className="h-4 w-4 mr-1" />
              {loading && lastAction.includes('Diagnostic') ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              Run Diagnosis
            </Button>
            
            <Button 
              onClick={handleAutoFix} 
              disabled={loading || !report}
              variant="default"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {loading && lastAction.includes('Auto-fix') ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              Auto Fix
            </Button>
            
            <Button 
              onClick={handleReset} 
              disabled={loading}
              variant="destructive"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {loading && lastAction.includes('Reset') ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
              Reset All Data
            </Button>
          </div>

          {/* Last Action Status */}
          {lastAction && (
            <div className="p-2 bg-muted rounded-md text-sm">
              <strong>Last Action:</strong> {lastAction}
            </div>
          )}

          {/* Diagnostic Report */}
          {report && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Diagnostic Report</h3>
                {getStatusBadge(report.conflictStatus.hasConflict)}
              </div>

              {/* IndexedDB State */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">IndexedDB State</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div>Has User: <Badge variant={report.indexedDBState.hasUser ? 'default' : 'secondary'}>{report.indexedDBState.hasUser ? 'Yes' : 'No'}</Badge></div>
                  {report.indexedDBState.hasUser && (
                    <>
                      <div>User ID: {report.indexedDBState.userId}</div>
                      <div>Username: {report.indexedDBState.username || 'N/A'}</div>
                      <div>Onboarding Complete: <Badge variant={report.indexedDBState.onboardingComplete ? 'default' : 'destructive'}>{report.indexedDBState.onboardingComplete ? 'Yes' : 'No'}</Badge></div>
                      <div>Has Plan: <Badge variant={report.indexedDBState.hasPlan ? 'default' : 'destructive'}>{report.indexedDBState.hasPlan ? 'Yes' : 'No'}</Badge></div>
                      <div>Created: {report.indexedDBState.userCreatedAt?.toLocaleString()}</div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* localStorage State */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">localStorage State</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div>Has Onboarding Flag: <Badge variant={report.localStorageState.hasOnboardingFlag ? 'default' : 'secondary'}>{report.localStorageState.hasOnboardingFlag ? 'Yes' : 'No'}</Badge></div>
                  <div>Onboarding Value: {report.localStorageState.onboardingValue || 'null'}</div>
                </CardContent>
              </Card>

              {/* Conflict Analysis */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Conflict Analysis</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="font-medium">{report.conflictStatus.description}</div>
                  <div className={`font-semibold ${getRecommendationColor(report.conflictStatus.recommendation)}`}>
                    Recommendation: {report.conflictStatus.recommendation.replace('_', ' ').toUpperCase()}
                  </div>
                </CardContent>
              </Card>

              <div className="text-xs text-muted-foreground">
                Report generated: {report.timestamp.toLocaleString()}
              </div>
            </div>
          )}

          {/* Instructions */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4 text-sm">
              <div className="space-y-2">
                <div><strong>Run Diagnosis:</strong> Analyze current onboarding state</div>
                <div><strong>Auto Fix:</strong> Automatically resolve detected conflicts</div>
                <div><strong>Reset All Data:</strong> ⚠️ Clear all user data for fresh start</div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}