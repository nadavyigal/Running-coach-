/**
 * Secure API Key Management
 * 
 * Centralized, secure handling of API key validation without exposing
 * sensitive information or validation logic to the client side.
 */

interface ApiKeyValidationResult {
  isValid: boolean;
  service: 'openai' | 'posthog';
  errorCode?: 'MISSING' | 'INVALID_FORMAT' | 'INVALID_KEY';
}

/**
 * Securely validate OpenAI API key
 * 
 * This function validates the API key format and availability without
 * exposing the actual key or detailed validation logic to potential attackers.
 */
export function validateOpenAIKey(): ApiKeyValidationResult {
  const key = process.env.OPENAI_API_KEY;
  
  // Check if key exists
  if (!key) {
    return {
      isValid: false,
      service: 'openai',
      errorCode: 'MISSING'
    };
  }
  
  // Check if key is placeholder
  if (key === 'your_openai_api_key_here' || key.length < 10) {
    return {
      isValid: false,
      service: 'openai',
      errorCode: 'INVALID_FORMAT'
    };
  }
  
  // Check basic format (OpenAI keys start with 'sk-')
  if (!key.startsWith('sk-')) {
    return {
      isValid: false,
      service: 'openai',
      errorCode: 'INVALID_FORMAT'
    };
  }
  
  return {
    isValid: true,
    service: 'openai'
  };
}

/**
 * Securely validate PostHog API key
 */
export function validatePostHogKey(): ApiKeyValidationResult {
  const key = process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
  
  if (!key || key === 'your_posthog_api_key_here') {
    return {
      isValid: false,
      service: 'posthog',
      errorCode: 'MISSING'
    };
  }
  
  // PostHog keys start with 'phc_'
  if (!key.startsWith('phc_')) {
    return {
      isValid: false,
      service: 'posthog',
      errorCode: 'INVALID_FORMAT'
    };
  }
  
  return {
    isValid: true,
    service: 'posthog'
  };
}

/**
 * Get a secure error response for API key issues
 * 
 * This function provides appropriate error responses without exposing
 * sensitive information about the API key configuration.
 */
export function getSecureApiKeyError(validation: ApiKeyValidationResult): {
  message: string;
  status: number;
  errorType: string;
  fallbackRequired: boolean;
} {
  switch (validation.errorCode) {
    case 'MISSING':
      return {
        message: `${validation.service.toUpperCase()} service is not configured. Please contact support.`,
        status: 503,
        errorType: 'SERVICE_UNAVAILABLE',
        fallbackRequired: true
      };
    
    case 'INVALID_FORMAT':
    case 'INVALID_KEY':
      return {
        message: `${validation.service.toUpperCase()} service authentication failed. Please contact support.`,
        status: 503,
        errorType: 'SERVICE_UNAVAILABLE',
        fallbackRequired: true
      };
    
    default:
      return {
        message: 'External service is temporarily unavailable. Please try again later.',
        status: 503,
        errorType: 'SERVICE_UNAVAILABLE',
        fallbackRequired: true
      };
  }
}

/**
 * Secure wrapper for API operations that require OpenAI
 * 
 * This function centralizes API key validation and provides consistent
 * error handling across all routes that use OpenAI.
 */
export async function withSecureOpenAI<T>(
  operation: () => Promise<T>,
  fallbackValue?: T
): Promise<{ success: boolean; data?: T; error?: any }> {
  const validation = validateOpenAIKey();
  
  if (!validation.isValid) {
    const error = getSecureApiKeyError(validation);
    return { 
      success: false, 
      error,
      data: fallbackValue 
    };
  }
  
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    console.error('OpenAI operation failed:', error);
    return { 
      success: false, 
      error: {
        message: 'AI service temporarily unavailable. Please try again later.',
        status: 503,
        errorType: 'AI_SERVICE_ERROR',
        fallbackRequired: true
      },
      data: fallbackValue
    };
  }
}

/**
 * Runtime environment configuration check
 * 
 * Validates that all required API keys are properly configured
 * without exposing them.
 */
export function validateEnvironmentConfiguration(): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  const openaiValidation = validateOpenAIKey();
  if (!openaiValidation.isValid) {
    issues.push('OpenAI API key configuration issue');
  }
  
  // Only validate PostHog in production
  if (process.env.NODE_ENV === 'production') {
    const posthogValidation = validatePostHogKey();
    if (!posthogValidation.isValid) {
      issues.push('PostHog analytics configuration issue');
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Log configuration status securely
 * 
 * Logs configuration status without exposing sensitive information.
 */
export function logConfigurationStatus(): void {
  const config = validateEnvironmentConfiguration();
  
  if (config.isValid) {
    console.log('✅ All required services are properly configured');
  } else {
    console.warn('⚠️ Configuration issues detected:', config.issues);
    console.warn('📋 Some features may use fallback behavior');
  }
}