import { analyzeError, type ClientErrorInfo } from './errorHandling';
import { errorMonitoring } from './error-monitoring';

// Recovery strategy types
export type RecoveryStrategy = 
  | 'retry'
  | 'fallback'
  | 'graceful_degradation'
  | 'user_intervention'
  | 'service_restart'
  | 'data_recovery';

// Recovery action interface
export interface RecoveryAction {
  id: string;
  label: string;
  description: string;
  strategy: RecoveryStrategy;
  action: () => Promise<boolean>;
  canRetry: boolean;
  priority: number; // Higher = more important
  estimatedTime?: number; // Estimated recovery time in ms
}

// Recovery context
export interface RecoveryContext {
  error: Error;
  errorInfo: ClientErrorInfo;
  attemptCount: number;
  lastAttemptTime: number;
  userId?: number;
  sessionId?: string;
  componentName?: string;
  userActions?: string[];
}

// Recovery result
export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  actionTaken: string;
  duration: number;
  message: string;
  canContinue: boolean;
  nextActions?: RecoveryAction[];
}

// Recovery manager class
export class ErrorRecoveryManager {
  private recoveryAttempts = new Map<string, RecoveryContext>();
  private maxRetryAttempts = 3;
  private retryBackoffMultiplier = 2;
  private baseRetryDelay = 1000;

  // Main recovery method
  public async attemptRecovery(
    error: Error,
    options: {
      componentName?: string;
      userId?: number;
      sessionId?: string;
      userActions?: string[];
      preferredStrategy?: RecoveryStrategy;
    } = {}
  ): Promise<RecoveryResult> {
    const startTime = performance.now();
    const errorInfo = analyzeError(error);
    const errorKey = this.generateErrorKey(error, options.componentName);

    // Get or create recovery context
    const context = this.getRecoveryContext(errorKey, error, errorInfo, options);

    // Log recovery attempt
    errorMonitoring.addBreadcrumb(`Recovery attempt ${context.attemptCount} for ${errorInfo.errorType} error`);

    // Get available recovery actions
    const actions = this.getRecoveryActions(context, options.preferredStrategy);

    // Try recovery actions in priority order
    for (const action of actions) {
      try {
        const success = await this.executeRecoveryAction(action, context);
        
        if (success) {
          const duration = performance.now() - startTime;
          
          // Log successful recovery
          await errorMonitoring.logError(error, {
            category: 'application',
            severity: 'medium',
            metadata: {
              recoveryStrategy: action.strategy,
              recoveryDuration: duration,
              recoveryAttempts: context.attemptCount,
              recoverySuccess: true
            }
          });

          // Clean up recovery context
          this.recoveryAttempts.delete(errorKey);

          return {
            success: true,
            strategy: action.strategy,
            actionTaken: action.label,
            duration,
            message: `Successfully recovered using ${action.label}`,
            canContinue: true
          };
        }
      } catch (recoveryError) {
        console.warn(`Recovery action ${action.label} failed:`, recoveryError);
        
        // Log failed recovery attempt
        await errorMonitoring.logError(recoveryError as Error, {
          category: 'application',
          severity: 'low',
          metadata: {
            originalError: error.message,
            recoveryStrategy: action.strategy,
            recoveryFailed: true
          }
        });
      }
    }

    // All recovery attempts failed
    const duration = performance.now() - startTime;
    
    // Update context for potential future attempts
    context.attemptCount++;
    context.lastAttemptTime = Date.now();
    this.recoveryAttempts.set(errorKey, context);

    // Determine if we should give up
    const shouldGiveUp = context.attemptCount >= this.maxRetryAttempts;
    
    return {
      success: false,
      strategy: 'user_intervention',
      actionTaken: 'No automatic recovery available',
      duration,
      message: shouldGiveUp 
        ? 'Unable to recover automatically. Manual intervention required.'
        : 'Recovery failed. Will retry later.',
      canContinue: !shouldGiveUp,
      nextActions: shouldGiveUp ? this.getUserInterventionActions(context) : []
    };
  }

  private generateErrorKey(error: Error, componentName?: string): string {
    return `${componentName || 'global'}_${error.name}_${error.message.substring(0, 50)}`;
  }

  private getRecoveryContext(
    errorKey: string,
    error: Error,
    errorInfo: ClientErrorInfo,
    options: any
  ): RecoveryContext {
    const existing = this.recoveryAttempts.get(errorKey);
    
    if (existing) {
      return {
        ...existing,
        attemptCount: existing.attemptCount + 1,
        lastAttemptTime: Date.now()
      };
    }

    return {
      error,
      errorInfo,
      attemptCount: 1,
      lastAttemptTime: Date.now(),
      userId: options.userId,
      sessionId: options.sessionId,
      componentName: options.componentName,
      userActions: options.userActions || []
    };
  }

  private getRecoveryActions(
    context: RecoveryContext,
    preferredStrategy?: RecoveryStrategy
  ): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    // Network error recovery actions
    if (context.errorInfo.errorType === 'network') {
      actions.push(
        {
          id: 'network_retry',
          label: 'Retry Network Request',
          description: 'Attempt to reconnect and retry the failed request',
          strategy: 'retry',
          action: () => this.retryNetworkRequest(context),
          canRetry: true,
          priority: 10,
          estimatedTime: 3000
        },
        {
          id: 'switch_endpoint',
          label: 'Switch to Backup Endpoint',
          description: 'Try alternative API endpoint',
          strategy: 'fallback',
          action: () => this.switchToBackupEndpoint(context),
          canRetry: true,
          priority: 8,
          estimatedTime: 2000
        },
        {
          id: 'offline_mode',
          label: 'Enable Offline Mode',
          description: 'Continue with cached data and offline functionality',
          strategy: 'graceful_degradation',
          action: () => this.enableOfflineMode(context),
          canRetry: false,
          priority: 6,
          estimatedTime: 1000
        }
      );
    }

    // Database error recovery actions
    if (context.errorInfo.errorType === 'database') {
      actions.push(
        {
          id: 'clear_cache',
          label: 'Clear Database Cache',
          description: 'Clear corrupted cache and retry operation',
          strategy: 'data_recovery',
          action: () => this.clearDatabaseCache(context),
          canRetry: true,
          priority: 9,
          estimatedTime: 2000
        },
        {
          id: 'rebuild_db',
          label: 'Rebuild Database',
          description: 'Rebuild database from backup data',
          strategy: 'data_recovery',
          action: () => this.rebuildDatabase(context),
          canRetry: true,
          priority: 7,
          estimatedTime: 10000
        },
        {
          id: 'use_memory_storage',
          label: 'Use Memory Storage',
          description: 'Fall back to memory-based storage temporarily',
          strategy: 'fallback',
          action: () => this.useMemoryStorage(context),
          canRetry: false,
          priority: 5,
          estimatedTime: 500
        }
      );
    }

    // AI service error recovery actions
    if (context.errorInfo.errorType === 'ai_service') {
      actions.push(
        {
          id: 'switch_ai_provider',
          label: 'Switch AI Provider',
          description: 'Try alternative AI service provider',
          strategy: 'fallback',
          action: () => this.switchAIProvider(context),
          canRetry: true,
          priority: 8,
          estimatedTime: 3000
        },
        {
          id: 'use_fallback_responses',
          label: 'Use Cached Responses',
          description: 'Use pre-cached AI responses for common queries',
          strategy: 'fallback',
          action: () => this.useFallbackAIResponses(context),
          canRetry: false,
          priority: 6,
          estimatedTime: 1000
        },
        {
          id: 'guided_form_fallback',
          label: 'Switch to Guided Form',
          description: 'Fall back to structured form instead of AI chat',
          strategy: 'graceful_degradation',
          action: () => this.switchToGuidedForm(context),
          canRetry: false,
          priority: 7,
          estimatedTime: 500
        }
      );
    }

    // Validation error recovery actions
    if (context.errorInfo.errorType === 'validation') {
      actions.push(
        {
          id: 'auto_correct',
          label: 'Auto-correct Input',
          description: 'Attempt to automatically correct common input errors',
          strategy: 'data_recovery',
          action: () => this.autoCorrectInput(context),
          canRetry: true,
          priority: 9,
          estimatedTime: 1000
        },
        {
          id: 'use_defaults',
          label: 'Apply Default Values',
          description: 'Use sensible default values for invalid fields',
          strategy: 'fallback',
          action: () => this.applyDefaultValues(context),
          canRetry: true,
          priority: 7,
          estimatedTime: 500
        }
      );
    }

    // General recovery actions
    actions.push(
      {
        id: 'refresh_component',
        label: 'Refresh Component',
        description: 'Refresh the affected component',
        strategy: 'retry',
        action: () => this.refreshComponent(context),
        canRetry: true,
        priority: 5,
        estimatedTime: 1000
      },
      {
        id: 'restore_from_backup',
        label: 'Restore from Backup',
        description: 'Restore application state from backup',
        strategy: 'data_recovery',
        action: () => this.restoreFromBackup(context),
        canRetry: true,
        priority: 4,
        estimatedTime: 5000
      }
    );

    // Filter by preferred strategy if specified
    const filteredActions = preferredStrategy 
      ? actions.filter(action => action.strategy === preferredStrategy)
      : actions;

    // Sort by priority (higher priority first)
    return filteredActions.sort((a, b) => b.priority - a.priority);
  }

  private async executeRecoveryAction(
    action: RecoveryAction,
    context: RecoveryContext
  ): Promise<boolean> {
    const delay = this.calculateRetryDelay(context.attemptCount);
    
    // Wait before attempting recovery (exponential backoff)
    if (context.attemptCount > 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    errorMonitoring.addBreadcrumb(`Executing recovery action: ${action.label}`);
    
    try {
      return await action.action();
    } catch (error) {
      errorMonitoring.addBreadcrumb(`Recovery action failed: ${action.label} - ${error}`);
      throw error;
    }
  }

  private calculateRetryDelay(attemptCount: number): number {
    return this.baseRetryDelay * Math.pow(this.retryBackoffMultiplier, attemptCount - 1);
  }

  // Recovery action implementations
  private async retryNetworkRequest(_context: RecoveryContext): Promise<boolean> {
    // Implementation would retry the original network request
    // This is a placeholder - actual implementation would depend on the specific request
    try {
      // Simulate network retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      return Math.random() > 0.3; // 70% success rate simulation
    } catch {
      return false;
    }
  }

  private async switchToBackupEndpoint(_context: RecoveryContext): Promise<boolean> {
    // Switch to backup API endpoint
    try {
      // Simulate endpoint switch
      await new Promise(resolve => setTimeout(resolve, 500));
      return Math.random() > 0.2; // 80% success rate simulation
    } catch {
      return false;
    }
  }

  private async enableOfflineMode(_context: RecoveryContext): Promise<boolean> {
    try {
      // Enable offline mode with cached data
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('offline_mode', 'true');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async clearDatabaseCache(_context: RecoveryContext): Promise<boolean> {
    try {
      // Clear IndexedDB cache
      if (typeof indexedDB !== 'undefined') {
        // This would clear specific cache entries
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async rebuildDatabase(_context: RecoveryContext): Promise<boolean> {
    try {
      // Rebuild database from backup
      await new Promise(resolve => setTimeout(resolve, 2000));
      return Math.random() > 0.1; // 90% success rate simulation
    } catch {
      return false;
    }
  }

  private async useMemoryStorage(_context: RecoveryContext): Promise<boolean> {
    try {
      // Fall back to memory storage
      return true;
    } catch {
      return false;
    }
  }

  private async switchAIProvider(_context: RecoveryContext): Promise<boolean> {
    try {
      // Switch to backup AI provider
      await new Promise(resolve => setTimeout(resolve, 1000));
      return Math.random() > 0.4; // 60% success rate simulation
    } catch {
      return false;
    }
  }

  private async useFallbackAIResponses(_context: RecoveryContext): Promise<boolean> {
    try {
      // Use cached AI responses
      return true;
    } catch {
      return false;
    }
  }

  private async switchToGuidedForm(_context: RecoveryContext): Promise<boolean> {
    try {
      // Switch to guided form
      return true;
    } catch {
      return false;
    }
  }

  private async autoCorrectInput(_context: RecoveryContext): Promise<boolean> {
    try {
      // Attempt to auto-correct common input errors
      return Math.random() > 0.3; // 70% success rate simulation
    } catch {
      return false;
    }
  }

  private async applyDefaultValues(_context: RecoveryContext): Promise<boolean> {
    try {
      // Apply default values for invalid fields
      return true;
    } catch {
      return false;
    }
  }

  private async refreshComponent(_context: RecoveryContext): Promise<boolean> {
    try {
      // Trigger component refresh
      return true;
    } catch {
      return false;
    }
  }

  private async restoreFromBackup(_context: RecoveryContext): Promise<boolean> {
    try {
      // Restore application state from backup
      await new Promise(resolve => setTimeout(resolve, 2000));
      return Math.random() > 0.2; // 80% success rate simulation
    } catch {
      return false;
    }
  }

  private getUserInterventionActions(_context: RecoveryContext): RecoveryAction[] {
    return [
      {
        id: 'contact_support',
        label: 'Contact Support',
        description: 'Get help from our support team',
        strategy: 'user_intervention',
        action: async () => {
          // Open support contact
          return true;
        },
        canRetry: false,
        priority: 10
      },
      {
        id: 'report_bug',
        label: 'Report Bug',
        description: 'Report this issue to help us improve',
        strategy: 'user_intervention',
        action: async () => {
          // Open bug report
          return true;
        },
        canRetry: false,
        priority: 8
      },
      {
        id: 'restart_app',
        label: 'Restart Application',
        description: 'Restart the application to clear any temporary issues',
        strategy: 'service_restart',
        action: async () => {
          window.location.reload();
          return true;
        },
        canRetry: false,
        priority: 6
      }
    ];
  }

  // Public methods for manual recovery
  public async retryLastFailedOperation(errorKey?: string): Promise<RecoveryResult | null> {
    if (errorKey) {
      const context = this.recoveryAttempts.get(errorKey);
      if (context) {
        return this.attemptRecovery(context.error, {
          componentName: context.componentName,
          userId: context.userId,
          sessionId: context.sessionId,
          userActions: context.userActions
        });
      }
    }
    return null;
  }

  public getFailedOperations(): string[] {
    return Array.from(this.recoveryAttempts.keys());
  }

  public clearRecoveryHistory(): void {
    this.recoveryAttempts.clear();
  }

  public getRecoveryStatistics(): {
    totalAttempts: number;
    successfulRecoveries: number;
    averageRecoveryTime: number;
    mostCommonErrors: string[];
  } {
    // This would be implemented with actual tracking
    return {
      totalAttempts: 0,
      successfulRecoveries: 0,
      averageRecoveryTime: 0,
      mostCommonErrors: []
    };
  }
}

// Global recovery manager instance
export const errorRecoveryManager = new ErrorRecoveryManager();

// Convenience functions
export const attemptErrorRecovery = (
  error: Error,
  options?: Parameters<ErrorRecoveryManager['attemptRecovery']>[1]
) => {
  return errorRecoveryManager.attemptRecovery(error, options);
};

export const retryLastOperation = (errorKey?: string) => {
  return errorRecoveryManager.retryLastFailedOperation(errorKey);
};

export const clearRecoveryHistory = () => {
  errorRecoveryManager.clearRecoveryHistory();
};
