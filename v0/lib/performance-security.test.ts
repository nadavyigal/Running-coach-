import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PerformanceMonitor from './performance.monitoring';
import SecurityMonitor from './security.monitoring';
import { securityConfig, rateLimiter, advancedSanitization, validateFile } from './security.config';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock performance API
const mockPerformance = {
  getEntriesByType: vi.fn(),
  now: vi.fn(() => 1000),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024,
    jsHeapSizeLimit: 200 * 1024 * 1024,
  },
};

// Mock PerformanceObserver
global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
}));

Object.defineProperty(global, 'performance', {
  writable: true,
  value: mockPerformance,
});
Object.defineProperty(window, 'performance', {
  writable: true,
  value: mockPerformance,
});

describe('Performance Monitoring', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    performanceMonitor.reset();
  });

  describe('Performance Metrics Tracking', () => {
    it('should track page load time', () => {
      const mockNavigation = {
        fetchStart: 1000,
        loadEventEnd: 4000,
      };
      
      mockPerformance.getEntriesByType.mockReturnValue([mockNavigation]);
      
      performanceMonitor.trackPageLoad();
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.pageLoadTime).toBe(3000);
    });

    it('should track memory usage', () => {
      performanceMonitor.trackMemoryUsage();
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.memoryUsage).toBe(50 * 1024 * 1024);
    });

    it('should track API response times', () => {
      const startTime = 1000;
      const endTime = 1500;
      const url = '/api/test';
      
      performanceMonitor.trackApiCall(url, startTime, endTime, true);
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.apiResponseTime).toBe(500);
    });

    it('should calculate error rate correctly', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      performanceMonitor.reset();
      performanceMonitor.trackApiCall('/api/success', 1000, 1100, true);
      performanceMonitor.trackApiCall('/api/error', 1000, 1200, false);
      performanceMonitor.trackApiCall('/api/success2', 1000, 1300, true);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.errorRate).toBeCloseTo(0.33, 2);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Performance Alerts', () => {
    it('should generate alerts for slow page load', () => {
      const mockNavigation = {
        fetchStart: 1000,
        loadEventEnd: 6000, // 5 second load time
      };
      
      mockPerformance.getEntriesByType.mockReturnValue([mockNavigation]);
      performanceMonitor.trackPageLoad();
      
      const alerts = performanceMonitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('pageLoadTime');
      expect(alerts[0].severity).toBe('warning');
    });

    it('should generate alerts for high memory usage', () => {
      const originalPerformance = global.performance;
      const originalWindowPerformance = window.performance;
      const highMemoryPerformance = {
        ...mockPerformance,
        memory: {
          ...mockPerformance.memory,
          usedJSHeapSize: 150 * 1024 * 1024, // 150MB
        },
      };
      
      Object.defineProperty(global, 'performance', {
        writable: true,
        value: highMemoryPerformance,
      });
      
      performanceMonitor.trackMemoryUsage();
      
      const alerts = performanceMonitor.getAlerts();
      expect(alerts.some((alert) => alert.type === 'memoryUsage')).toBe(true);
      Object.defineProperty(global, 'performance', {
        writable: true,
        value: originalPerformance,
      });
      Object.defineProperty(window, 'performance', {
        writable: true,
        value: originalWindowPerformance,
      });
    });

    it('should detect performance regressions', () => {
      // Simulate poor performance
      const mockNavigation = {
        fetchStart: 1000,
        loadEventEnd: 6000,
      };
      
      mockPerformance.getEntriesByType.mockReturnValue([mockNavigation]);
      performanceMonitor.trackPageLoad();
      
      const regressions = performanceMonitor.checkPerformanceRegressions();
      expect(regressions.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Report Generation', () => {
    it('should generate comprehensive performance report', () => {
      performanceMonitor.trackApiCall('/api/test', 1000, 2500, true); // Slow API
      
      const report = performanceMonitor.generateReport();
      
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('alerts');
      expect(report).toHaveProperty('summary');
      expect(report.summary).toHaveProperty('healthy');
      expect(report.summary).toHaveProperty('recommendations');
      expect(Array.isArray(report.summary.recommendations)).toBe(true);
    });
  });
});

describe('Security Monitoring', () => {
  let securityMonitor: SecurityMonitor;

  beforeEach(() => {
    securityMonitor = new SecurityMonitor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    securityMonitor.reset();
  });

  describe('Security Event Tracking', () => {
    it('should track security events', () => {
      const event = {
        type: 'test_event',
        severity: 'warning' as const,
        message: 'Test security event',
        data: { test: true },
      };
      
      securityMonitor.trackSecurityEvent(event);
      const metrics = securityMonitor.getSecurityMetrics();
      
      expect(metrics.totalEvents).toBe(1);
      expect(metrics.warningEvents).toBe(1);
      expect(metrics.lastEvent?.type).toBe('test_event');
    });

    it('should categorize events by severity', () => {
      securityMonitor.trackSecurityEvent({
        type: 'critical_event',
        severity: 'critical',
        message: 'Critical security event',
      });
      
      securityMonitor.trackSecurityEvent({
        type: 'warning_event',
        severity: 'warning',
        message: 'Warning security event',
      });
      
      const metrics = securityMonitor.getSecurityMetrics();
      expect(metrics.criticalEvents).toBe(1);
      expect(metrics.warningEvents).toBe(1);
      expect(metrics.totalEvents).toBe(2);
    });
  });

  describe('Security Alert Generation', () => {
    it('should generate alerts for critical events', () => {
      securityMonitor.trackSecurityEvent({
        type: 'xss_attempt',
        severity: 'critical',
        message: 'XSS attempt detected',
        data: { payload: '<script>alert("xss")</script>' },
      });
      
      const alerts = securityMonitor.getSecurityAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should track suspicious activities', () => {
      // Simulate multiple suspicious events
      for (let i = 0; i < 5; i++) {
        securityMonitor.trackSecurityEvent({
          type: 'suspicious_data_access',
          severity: 'warning',
          message: 'Suspicious data access detected',
        });
      }
      
      const metrics = securityMonitor.getSecurityMetrics();
      expect(metrics.suspiciousActivities).toBe(5);
    });
  });

  describe('Security Report Generation', () => {
    it('should generate comprehensive security report', () => {
      securityMonitor.trackSecurityEvent({
        type: 'xss_attempt',
        severity: 'critical',
        message: 'XSS attempt detected',
      });
      
      const report = securityMonitor.generateSecurityReport();
      
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('alerts');
      expect(report).toHaveProperty('recentEvents');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('threatLevel');
      expect(report.threatLevel).toBe('critical');
    });
  });
});

describe('Security Configuration', () => {
  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const result = await rateLimiter.check('test-ip');
      
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('should block requests exceeding limit', async () => {
      // Simulate reaching the limit
      for (let i = 0; i < 100; i++) {
        await rateLimiter.check('test-ip-blocked');
      }
      
      const result = await rateLimiter.check('test-ip-blocked');
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset rate limit after window expires', async () => {
      // Mock time to simulate window expiration
      const originalNow = Date.now;
      Date.now = vi.fn().mockReturnValue(1000);
      
      await rateLimiter.check('test-ip-reset');
      
      // Simulate time passing beyond window
      Date.now = vi.fn().mockReturnValue(1000 + 16 * 60 * 1000); // 16 minutes later
      
      const result = await rateLimiter.check('test-ip-reset');
      expect(result.success).toBe(true);
      
      Date.now = originalNow;
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML content', () => {
      const maliciousHtml = '<script>alert("xss")</script><p>Safe content</p>';
      const sanitized = advancedSanitization.secureHtml(maliciousHtml);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('should sanitize SQL injection attempts', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const sanitized = advancedSanitization.sqlSafe(sqlInjection);
      
      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('--');
      expect(sanitized).not.toContain('DROP TABLE');
    });

    it('should sanitize file names', () => {
      const maliciousFileName = '../../../etc/passwd';
      const sanitized = advancedSanitization.fileName(maliciousFileName);
      
      expect(sanitized).not.toContain('../');
      expect(sanitized).toBe('etcpasswd');
    });
  });

  describe('File Validation', () => {
    it('should validate allowed file types', () => {
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const result = validateFile(validFile);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject disallowed file types', () => {
      const invalidFile = new File(['content'], 'test.exe', { type: 'application/exe' });
      const result = validateFile(invalidFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject files exceeding size limit', () => {
      // Create a large file (6MB)
      const largeContent = new Array(6 * 1024 * 1024).fill('a').join('');
      const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      const result = validateFile(largeFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });
  });
});

describe('Security Configuration CSP', () => {
  it('should have proper CSP configuration', () => {
    expect(securityConfig.csp).toHaveProperty('default-src');
    expect(securityConfig.csp).toHaveProperty('script-src');
    expect(securityConfig.csp).toHaveProperty('style-src');
    expect(securityConfig.csp).toHaveProperty('img-src');
    expect(securityConfig.csp).toHaveProperty('connect-src');
    
    expect(securityConfig.csp['frame-src']).toContain("'none'");
    expect(securityConfig.csp['object-src']).toContain("'none'");
  });

  it('should have security headers configured', () => {
    expect(securityConfig.headers).toHaveProperty('X-Frame-Options');
    expect(securityConfig.headers).toHaveProperty('X-Content-Type-Options');
    expect(securityConfig.headers).toHaveProperty('Referrer-Policy');
    expect(securityConfig.headers).toHaveProperty('Strict-Transport-Security');
    
    expect(securityConfig.headers['X-Frame-Options']).toBe('DENY');
    expect(securityConfig.headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('should have proper validation limits', () => {
    expect(securityConfig.validation.maxLengths.chatMessage).toBe(1000);
    expect(securityConfig.validation.maxLengths.userName).toBe(50);
    expect(securityConfig.validation.sanitization.stripHtml).toBe(true);
  });
});

describe('Integration Tests', () => {
  it('should integrate performance and security monitoring', () => {
    const performanceMonitor = new PerformanceMonitor();
    const securityMonitor = new SecurityMonitor();
    
    // Simulate a slow API call that might be suspicious
    performanceMonitor.trackApiCall('/api/sensitive', 1000, 3000, false);
    
    securityMonitor.trackSecurityEvent({
      type: 'suspicious_api_access',
      severity: 'warning',
      message: 'Slow API access to sensitive endpoint',
    });
    
    const perfReport = performanceMonitor.generateReport();
    const secReport = securityMonitor.generateSecurityReport();
    
    expect(perfReport.summary.healthy).toBe(false);
    expect(secReport.threatLevel).toBe('low');
  });

  it('should handle multiple concurrent security events', () => {
    const securityMonitor = new SecurityMonitor();
    
    // Simulate multiple concurrent events
    const events = [
      { type: 'xss_attempt', severity: 'critical' as const, message: 'XSS 1' },
      { type: 'rate_limit_exceeded', severity: 'warning' as const, message: 'Rate limit 1' },
      { type: 'suspicious_data_access', severity: 'warning' as const, message: 'Data access 1' },
      { type: 'xss_attempt', severity: 'critical' as const, message: 'XSS 2' },
    ];
    
    events.forEach(event => securityMonitor.trackSecurityEvent(event));
    
    const metrics = securityMonitor.getSecurityMetrics();
    expect(metrics.totalEvents).toBe(4);
    expect(metrics.criticalEvents).toBe(2);
    expect(metrics.warningEvents).toBe(2);
  });
});

describe('Load Testing Simulation', () => {
  it('should handle high-frequency performance tracking', () => {
    const performanceMonitor = new PerformanceMonitor();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    performanceMonitor.reset();
    
    // Simulate 100 API calls
    const startTime = performance.now();
    for (let i = 0; i < 100; i++) {
      performanceMonitor.trackApiCall(
        `/api/test/${i}`,
        startTime + i,
        startTime + i + Math.random() * 1000,
        Math.random() > 0.1 // 90% success rate
      );
    }
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.errorRate).toBeLessThan(0.2); // Less than 20% error rate
    consoleErrorSpy.mockRestore();
  });

  it('should handle security monitoring under load', () => {
    const securityMonitor = new SecurityMonitor();
    
    // Simulate 50 security events
    for (let i = 0; i < 50; i++) {
      securityMonitor.trackSecurityEvent({
        type: 'load_test_event',
        severity: i % 10 === 0 ? 'critical' : 'warning',
        message: `Load test event ${i}`,
        data: { iteration: i },
      });
    }
    
    const metrics = securityMonitor.getSecurityMetrics();
    expect(metrics.totalEvents).toBe(50);
    expect(metrics.criticalEvents).toBe(5); // Every 10th event
  });
});
