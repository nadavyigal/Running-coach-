"use client"

import React from 'react'
import { 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  Database, 
  Bot, 
  RefreshCw, 
  X,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ClientErrorInfo, 
  analyzeError, 
  getRecoveryActions,
  networkStatus 
} from '@/lib/errorHandling'
import { useToast } from '@/hooks/use-toast'

export interface ErrorToastProps {
  error: Error
  onRetry?: () => void
  onDismiss?: () => void
  onFallback?: () => void
  showActions?: boolean
  autoRetry?: boolean
  retryCount?: number
  maxRetries?: number
}

export interface ToastVariant {
  variant: 'default' | 'destructive' | 'warning' | 'success' | 'info'
  icon?: React.ReactNode
  className?: string
}

export function ErrorToast({ 
  error, 
  onRetry, 
  onDismiss, 
  onFallback,
  showActions = true,
  autoRetry = false,
  retryCount = 0,
  maxRetries = 3
}: ErrorToastProps) {
  const errorInfo = analyzeError(error)
  const recoveryActions = getRecoveryActions(errorInfo)
  const { variant, icon } = getToastVariant(errorInfo.errorType)

  return (
    <Card className={`p-4 border-l-4 ${getVariantStyles(variant)}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          {icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {getErrorTitle(errorInfo.errorType)}
            </h4>
            <div className="flex items-center space-x-2">
              {retryCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  Attempt {retryCount}/{maxRetries}
                </Badge>
              )}
              {!networkStatus.getStatus() && (
                <Badge variant="destructive" className="text-xs">
                  Offline
                </Badge>
              )}
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={onDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            {errorInfo.userMessage}
          </p>
          
          {errorInfo.suggestedAction && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 italic">
              💡 {errorInfo.suggestedAction}
            </p>
          )}
          
          {showActions && (
            <div className="flex flex-wrap gap-2">
              {errorInfo.canRetry && onRetry && (
                <Button
                  size="sm"
                  variant={retryCount > 0 ? "outline" : "default"}
                  onClick={onRetry}
                  disabled={retryCount >= maxRetries}
                  className="text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {retryCount > 0 ? `Retry (${retryCount})` : 'Try Again'}
                </Button>
              )}
              
              {onFallback && errorInfo.errorType === 'ai_service' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onFallback}
                  className="text-xs"
                >
                  Use Guided Form
                </Button>
              )}
              
              {errorInfo.fallbackOptions?.map((option, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant="ghost"
                  onClick={() => console.log(`Fallback: ${option}`)}
                  className="text-xs"
                >
                  {option}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function getErrorTitle(errorType: ClientErrorInfo['errorType']): string {
  switch (errorType) {
    case 'network':
      return 'Connection Error'
    case 'offline':
      return 'You\'re Offline'
    case 'ai_service':
      return 'AI Service Unavailable'
    case 'database':
      return 'Storage Error'
    case 'validation':
      return 'Input Error'
    default:
      return 'Something Went Wrong'
  }
}

function getToastVariant(errorType: ClientErrorInfo['errorType']): ToastVariant {
  switch (errorType) {
    case 'network':
      return {
        variant: 'destructive',
        icon: <Wifi className="h-5 w-5 text-red-500" />
      }
    case 'offline':
      return {
        variant: 'warning',
        icon: <WifiOff className="h-5 w-5 text-orange-500" />
      }
    case 'ai_service':
      return {
        variant: 'warning',
        icon: <Bot className="h-5 w-5 text-orange-500" />
      }
    case 'database':
      return {
        variant: 'destructive',
        icon: <Database className="h-5 w-5 text-red-500" />
      }
    case 'validation':
      return {
        variant: 'warning',
        icon: <AlertTriangle className="h-5 w-5 text-orange-500" />
      }
    default:
      return {
        variant: 'destructive',
        icon: <AlertCircle className="h-5 w-5 text-red-500" />
      }
  }
}

function getVariantStyles(variant: ToastVariant['variant']): string {
  switch (variant) {
    case 'destructive':
      return 'border-red-500 bg-red-50 dark:bg-red-900/20'
    case 'warning':
      return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
    case 'success':
      return 'border-green-500 bg-green-50 dark:bg-green-900/20'
    case 'info':
      return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
    default:
      return 'border-gray-500 bg-gray-50 dark:bg-gray-900/20'
  }
}

// Enhanced toast hook that uses the error toast component
export function useErrorToast() {
  const { toast, dismiss } = useToast()

  const showError = (
    error: Error,
    options: {
      onRetry?: () => void
      onFallback?: () => void
      autoRetry?: boolean
      retryCount?: number
      maxRetries?: number
    } = {}
  ) => {
    const errorInfo = analyzeError(error)
    const { variant } = getToastVariant(errorInfo.errorType)
    
    return toast({
      title: getErrorTitle(errorInfo.errorType),
      description: (
        <ErrorToast
          error={error}
          onDismiss={() => dismiss()}
          showActions={true}
          {...options}
        />
      ),
      variant: variant === 'warning' ? 'default' : variant as 'default' | 'destructive',
      duration: errorInfo.errorType === 'validation' ? 5000 : 10000, // Longer for non-validation errors
    })
  }

  const showSuccess = (message: string, description?: string) => {
    return toast({
      title: message,
      description,
      variant: 'default',
      className: 'border-green-500 bg-green-50 dark:bg-green-900/20',
    })
  }

  const showWarning = (message: string, description?: string) => {
    return toast({
      title: message,
      description,
      variant: 'default',
      className: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
    })
  }

  const showInfo = (message: string, description?: string) => {
    return toast({
      title: message,
      description,
      variant: 'default',
      className: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    })
  }

  return {
    showError,
    showSuccess,
    showWarning,
    showInfo,
    dismiss
  }
}

// Network status indicator component
export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = React.useState(networkStatus.getStatus())
  const { showWarning, showSuccess } = useErrorToast()

  React.useEffect(() => {
    const unsubscribe = networkStatus.onStatusChange((online) => {
      setIsOnline(online)
      
      if (online) {
        showSuccess('Back Online', 'Connection restored')
      } else {
        showWarning('You\'re Offline', 'Some features may not be available')
      }
    })

    return unsubscribe
  }, [showWarning, showSuccess])

  if (isOnline) {
    return null
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50">
      <Card className="p-3 border-orange-500 bg-orange-50 dark:bg-orange-900/20">
        <div className="flex items-center space-x-2">
          <WifiOff className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
            Offline Mode
          </span>
        </div>
      </Card>
    </div>
  )
}

// Auto-retry component for critical operations
export function AutoRetryHandler({ 
  operation, 
  maxRetries = 3,
  onSuccess,
  onFailure,
  children 
}: {
  operation: () => Promise<unknown>
  maxRetries?: number
  onSuccess?: () => void
  onFailure?: (error: Error) => void
  children?: React.ReactNode
}) {
  const [retryCount, setRetryCount] = React.useState(0)
  const [isRetrying, setIsRetrying] = React.useState(false)
  const [lastError, setLastError] = React.useState<Error | null>(null)
  const { showError } = useErrorToast()

  const handleRetry = React.useCallback(async () => {
    if (retryCount >= maxRetries || isRetrying) {
      return
    }

    setIsRetrying(true)
    setRetryCount(prev => prev + 1)

    try {
      await operation()
      setLastError(null)
      setRetryCount(0)
      if (onSuccess) onSuccess()
    } catch (error) {
      const err = error as Error
      setLastError(err)
      
      if (retryCount + 1 >= maxRetries) {
        if (onFailure) onFailure(err)
      } else {
        showError(err, {
          onRetry: handleRetry,
          retryCount: retryCount + 1,
          maxRetries
        })
      }
    } finally {
      setIsRetrying(false)
    }
  }, [operation, retryCount, maxRetries, isRetrying, onSuccess, onFailure, showError])

  React.useEffect(() => {
    if (lastError && retryCount === 0) {
      showError(lastError, {
        onRetry: handleRetry,
        retryCount,
        maxRetries
      })
    }
  }, [lastError, retryCount, maxRetries, handleRetry, showError])

  return (
    <>
      {children}
      {isRetrying && (
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="p-3">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm">Retrying... ({retryCount}/{maxRetries})</span>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}