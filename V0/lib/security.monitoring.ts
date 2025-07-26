export interface SecurityEvent {
  type: string;
  severity: 'low' | 'warning' | 'critical';
  message: string;
  data?: Record<string, unknown>;
  timestamp?: string;
  userAgent?: string;
  url?: string;
  ip?: string;
}

export interface SecurityMetrics {
  totalEvents: number;
  criticalEvents: number;
  warningEvents: number;
  suspiciousActivities: number;
  blockedRequests: number;
  lastEvent?: SecurityEvent;
}

export interface SecurityAlert {
  id: string;
  event: SecurityEvent;
  threshold: number;
  count: number;
  timeWindow: number;
  timestamp: string;
}

export class SecurityMonitor {
  private securityEvents: SecurityEvent[] = [];
  private alerts: SecurityAlert[] = [];
  private activityCounters: Map<string, { count: number; lastReset: number }> = new Map();
  private blockedIPs: Set<string> = new Set();
  private suspiciousPatterns: RegExp[] = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\(/gi,
    /setTimeout\(/gi,
    /setInterval\(/gi,
    /document\.cookie/gi,
    /window\.location/gi,
    /alert\(/gi,
    /prompt\(/gi,
    /confirm\(/gi,
    /iframe/gi,
    /base64/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /livescript:/gi,
    /expression\(/gi,
    /url\(/gi,
    /import\(/gi,
  ];

  constructor() {
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    if (typeof window === 'undefined') return;

    // Monitor user activity patterns
    this.monitorUserActivity();
    
    // Monitor for XSS attempts
    this.monitorForXSS();
    
    // Monitor for suspicious DOM manipulations
    this.monitorDOMManipulation();
    
    // Monitor console access
    this.monitorConsoleAccess();
    
    // Monitor for data exfiltration attempts
    this.monitorDataExfiltration();
    
    // Clean up old events and reset counters periodically
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
  }

  // Track security events
  trackSecurityEvent(event: SecurityEvent) {
    const enrichedEvent: SecurityEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    this.securityEvents.push(enrichedEvent);
    this.reportSecurityEvent(enrichedEvent);
    
    // Check if this event should trigger an alert
    this.checkForSecurityAlert(enrichedEvent);
    
    // Keep only recent events (last 1000)
    if (this.securityEvents.length > 1000) {
      this.securityEvents.shift();
    }
  }

  // Monitor for suspicious user activities
  private monitorUserActivity() {
    if (typeof window === 'undefined') return;

    let apiCallCount = 0;
    let rapidClickCount = 0;
    let lastClickTime = 0;
    
    // Monitor API calls
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      apiCallCount++;
      
      // Check for rapid API calls (potential abuse)
      if (apiCallCount > 50) {
        this.trackSecurityEvent({
          type: 'rate_limit_exceeded',
          severity: 'warning',
          message: 'User exceeded API rate limit',
          data: { apiCallCount, endpoint: args[0] },
        });
      }
      
      // Reset counter every minute
      setTimeout(() => {
        apiCallCount = Math.max(0, apiCallCount - 1);
      }, 60000);
      
      return originalFetch(...args);
    };

    // Monitor rapid clicking (potential bot behavior)
    document.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastClickTime < 100) { // Less than 100ms between clicks
        rapidClickCount++;
        if (rapidClickCount > 10) {
          this.trackSecurityEvent({
            type: 'rapid_clicking',
            severity: 'warning',
            message: 'Detected rapid clicking pattern (potential bot)',
            data: { rapidClickCount, timeWindow: now - lastClickTime },
          });
        }
      } else {
        rapidClickCount = 0;
      }
      lastClickTime = now;
    });

    // Monitor for unusual navigation patterns
    let navigationCount = 0;
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      navigationCount++;
      if (navigationCount > 20) {
        this.trackSecurityEvent({
          type: 'excessive_navigation',
          severity: 'warning',
          message: 'Excessive navigation attempts detected',
          data: { navigationCount },
        });
      }
      return originalPushState.apply(this, args);
    }.bind(this);
  }

  // Monitor for XSS attempts
  private monitorForXSS() {
    if (typeof window === 'undefined') return;

    // Monitor innerHTML assignments
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (originalInnerHTML && originalInnerHTML.set) {
      Object.defineProperty(Element.prototype, 'innerHTML', {
        set: function(value: string) {
          // Check for XSS patterns
          if (this.detectSuspiciousContent(value)) {
            this.trackSecurityEvent({
              type: 'xss_attempt',
              severity: 'critical',
              message: 'Potential XSS attempt detected in innerHTML',
              data: { content: value.substring(0, 200) },
            });
          }
          return originalInnerHTML.set!.call(this, value);
        }.bind(this),
        get: originalInnerHTML.get,
        configurable: true,
      });
    }

    // Monitor for script injection attempts
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName: string) {
      const element = originalCreateElement.call(this, tagName);
      
      if (tagName.toLowerCase() === 'script') {
        this.trackSecurityEvent({
          type: 'script_creation',
          severity: 'warning',
          message: 'Dynamic script element creation detected',
          data: { tagName },
        });
      }
      
      return element;
    }.bind(this);
  }

  // Monitor DOM manipulation
  private monitorDOMManipulation() {
    if (typeof window === 'undefined' || !window.MutationObserver) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Check for suspicious attribute modifications
        if (mutation.type === 'attributes') {
          const target = mutation.target as Element;
          const attributeName = mutation.attributeName;
          
          if (attributeName && this.isSuspiciousAttribute(attributeName)) {
            const attributeValue = target.getAttribute(attributeName);
            if (attributeValue && this.detectSuspiciousContent(attributeValue)) {
              this.trackSecurityEvent({
                type: 'suspicious_attribute',
                severity: 'warning',
                message: `Suspicious ${attributeName} attribute detected`,
                data: { 
                  attributeName, 
                  attributeValue: attributeValue.substring(0, 200),
                  tagName: target.tagName 
                },
              });
            }
          }
        }
        
        // Check for suspicious node insertions
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (this.isSuspiciousElement(element)) {
                this.trackSecurityEvent({
                  type: 'suspicious_element',
                  severity: 'warning',
                  message: `Suspicious element inserted: ${element.tagName}`,
                  data: { 
                    tagName: element.tagName,
                    attributes: Array.from(element.attributes).map(attr => ({
                      name: attr.name,
                      value: attr.value.substring(0, 100)
                    }))
                  },
                });
              }
            }
          });
        }
      });
    });

    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
    });
  }

  // Monitor console access
  private monitorConsoleAccess() {
    if (typeof window === 'undefined') return;

    const originalConsoleLog = console.log;
    console.log = (...args) => {
      // Check if someone is trying to use console for malicious purposes
      const message = args.join(' ');
      if (this.detectSuspiciousContent(message)) {
        this.trackSecurityEvent({
          type: 'suspicious_console_access',
          severity: 'warning',
          message: 'Suspicious console usage detected',
          data: { message: message.substring(0, 200) },
        });
      }
      return originalConsoleLog.apply(console, args);
    };
  }

  // Monitor for data exfiltration attempts
  private monitorDataExfiltration() {
    if (typeof window === 'undefined') return;

    // Monitor for suspicious data access patterns
    let dataAccessCount = 0;
    const sensitiveDataPatterns = [
      /password/i,
      /token/i,
      /key/i,
      /secret/i,
      /auth/i,
      /session/i,
      /cookie/i,
    ];

    // Monitor localStorage access
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = function(key: string) {
      if (sensitiveDataPatterns.some(pattern => pattern.test(key))) {
        dataAccessCount++;
        if (dataAccessCount > 10) {
          this.trackSecurityEvent({
            type: 'suspicious_data_access',
            severity: 'warning',
            message: 'Excessive sensitive data access detected',
            data: { key, accessCount: dataAccessCount },
          });
        }
      }
      return originalGetItem.call(this, key);
    }.bind(this);

    // Reset counter every 5 minutes
    setInterval(() => {
      dataAccessCount = 0;
    }, 5 * 60 * 1000);
  }

  // Detect suspicious content
  private detectSuspiciousContent(content: string): boolean {
    return this.suspiciousPatterns.some(pattern => pattern.test(content));
  }

  // Check if attribute is suspicious
  private isSuspiciousAttribute(attributeName: string): boolean {
    const suspiciousAttributes = [
      'onclick', 'onload', 'onerror', 'onmouseover', 'onfocus',
      'onblur', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup',
      'src', 'href', 'action', 'formaction'
    ];
    return suspiciousAttributes.includes(attributeName.toLowerCase());
  }

  // Check if element is suspicious
  private isSuspiciousElement(element: Element): boolean {
    const suspiciousTags = ['script', 'iframe', 'object', 'embed', 'applet'];
    return suspiciousTags.includes(element.tagName.toLowerCase());
  }

  // Check for security alerts based on event patterns
  private checkForSecurityAlert(event: SecurityEvent) {
    const eventKey = `${event.type}_${event.severity}`;
    const now = Date.now();
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    
    // Get or create counter for this event type
    let counter = this.activityCounters.get(eventKey);
    if (!counter || now - counter.lastReset > timeWindow) {
      counter = { count: 0, lastReset: now };
      this.activityCounters.set(eventKey, counter);
    }
    
    counter.count++;
    
    // Define thresholds for different event types
    const thresholds: Record<string, number> = {
      xss_attempt_critical: 1,
      rate_limit_exceeded_warning: 3,
      suspicious_data_access_warning: 5,
      rapid_clicking_warning: 2,
      script_creation_warning: 3,
    };
    
    const threshold = thresholds[eventKey] || 10;
    
    if (counter.count >= threshold) {
      const alert: SecurityAlert = {
        id: `${eventKey}_${now}`,
        event,
        threshold,
        count: counter.count,
        timeWindow,
        timestamp: new Date().toISOString(),
      };
      
      this.alerts.push(alert);
      this.handleSecurityAlert(alert);
      
      // Reset counter after alert
      counter.count = 0;
      counter.lastReset = now;
    }
  }

  // Handle security alerts
  private handleSecurityAlert(alert: SecurityAlert) {
    console.warn(`Security Alert [${alert.event.severity.toUpperCase()}]:`, alert);
    
    // Block IP if critical security event
    if (alert.event.severity === 'critical') {
      // In a real implementation, you would block the IP
      console.warn('CRITICAL SECURITY ALERT - Consider blocking IP');
    }
    
    // Send alert to security monitoring service
    this.sendSecurityAlert(alert);
  }

  // Send security alert to monitoring service
  private async sendSecurityAlert(alert: SecurityAlert) {
    if (process.env.NODE_ENV === 'production') {
      try {
        await fetch('/api/security/alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
        });
      } catch (error) {
        console.error('Failed to send security alert:', error);
      }
    }
  }

  // Report security events
  private reportSecurityEvent(event: SecurityEvent) {
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Security event:', event);
      return;
    }

    // Send to security monitoring service in production
    try {
      fetch('/api/security/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }).catch(error => {
        console.error('Failed to report security event:', error);
      });
    } catch (error) {
      console.error('Failed to report security event:', error);
    }
  }

  // Get security metrics
  getSecurityMetrics(): SecurityMetrics {
    const criticalEvents = this.securityEvents.filter(e => e.severity === 'critical');
    const warningEvents = this.securityEvents.filter(e => e.severity === 'warning');
    const suspiciousActivities = this.securityEvents.filter(e => 
      ['xss_attempt', 'suspicious_data_access', 'rapid_clicking'].includes(e.type)
    );
    
    return {
      totalEvents: this.securityEvents.length,
      criticalEvents: criticalEvents.length,
      warningEvents: warningEvents.length,
      suspiciousActivities: suspiciousActivities.length,
      blockedRequests: this.blockedIPs.size,
      lastEvent: this.securityEvents[this.securityEvents.length - 1],
    };
  }

  // Get security alerts
  getSecurityAlerts(): SecurityAlert[] {
    return [...this.alerts];
  }

  // Get critical security alerts
  getCriticalAlerts(): SecurityAlert[] {
    return this.alerts.filter(alert => alert.event.severity === 'critical');
  }

  // Get recent security events
  getRecentEvents(minutes: number = 60): SecurityEvent[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.securityEvents.filter(event => {
      const eventTime = new Date(event.timestamp || 0).getTime();
      return eventTime > cutoff;
    });
  }

  // Generate security report
  generateSecurityReport(): {
    metrics: SecurityMetrics;
    alerts: SecurityAlert[];
    recentEvents: SecurityEvent[];
    recommendations: string[];
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
  } {
    const metrics = this.getSecurityMetrics();
    const criticalAlerts = this.getCriticalAlerts();
    const recentEvents = this.getRecentEvents(60);
    
    const recommendations: string[] = [];
    let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    // Determine threat level and recommendations
    if (criticalAlerts.length > 0) {
      threatLevel = 'critical';
      recommendations.push('Immediate action required: Critical security threats detected');
    } else if (metrics.warningEvents > 10) {
      threatLevel = 'high';
      recommendations.push('Multiple security warnings detected - review security logs');
    } else if (metrics.suspiciousActivities > 5) {
      threatLevel = 'medium';
      recommendations.push('Monitor suspicious activities closely');
    }
    
    if (metrics.totalEvents > 100) {
      recommendations.push('Consider implementing stricter security policies');
    }
    
    return {
      metrics,
      alerts: this.getSecurityAlerts(),
      recentEvents,
      recommendations,
      threatLevel,
    };
  }

  // Clean up old events and reset counters
  private cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    // Clean up old events
    this.securityEvents = this.securityEvents.filter(event => {
      const eventTime = new Date(event.timestamp || 0).getTime();
      return now - eventTime < maxAge;
    });
    
    // Clean up old alerts
    this.alerts = this.alerts.filter(alert => {
      const alertTime = new Date(alert.timestamp).getTime();
      return now - alertTime < maxAge;
    });
    
    // Clean up old activity counters
    for (const [key, counter] of this.activityCounters.entries()) {
      if (now - counter.lastReset > 60 * 60 * 1000) { // 1 hour
        this.activityCounters.delete(key);
      }
    }
  }

  // Reset all security data
  reset() {
    this.securityEvents = [];
    this.alerts = [];
    this.activityCounters.clear();
    this.blockedIPs.clear();
  }
}

// Global security monitor instance
export const securityMonitor = new SecurityMonitor();

// Auto-start monitoring in browser
if (typeof window !== 'undefined') {
  // Start monitoring when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Monitor is automatically initialized in constructor
    });
  }
}

export default SecurityMonitor;