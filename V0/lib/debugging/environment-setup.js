/**
 * Browser Environment Setup for Frontend Debugging
 * 
 * This module provides initialization commands for browser console debugging
 * of the Running Coach PWA application. It sets up React DevTools profiling,
 * fetch monitoring, and state update tracking.
 */

/**
 * Initialize debugging environment with comprehensive monitoring
 */
function initializeDebuggingEnvironment() {
  console.log("🔧 Debugging Environment Setup");
  console.log("📍 Running on:", window.location.href);
  console.log("⚛️ React Version:", window.React?.version || "Not detected");
  
  // Initialize all debugging systems
  setupReactDevToolsProfiler();
  setupFetchRequestMonitoring();
  setupStateUpdateTracking();
  setupPerformanceMonitoring();
  setupErrorTracking();
  
  console.log("✅ Debugging environment initialized successfully");
  console.log("💡 Available debugging functions:");
  console.log("   - window.debugReactRenders()");
  console.log("   - window.debugFetchRequests()");
  console.log("   - window.debugStateUpdates()");
  console.log("   - window.debugPerformance()");
  console.log("   - window.clearDebugLogs()");
}

/**
 * Setup React DevTools profiling with automatic render logging
 */
function setupReactDevToolsProfiler() {
  console.log("⚛️ Setting up React DevTools profiling...");
  
  // Check if React DevTools is available
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    let renderCount = 0;
    
    // Hook into React fiber commits
    const originalOnCommitFiberRoot = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot;
    
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = function(id, root, ...args) {
      renderCount++;
      console.log(`⚛️ React Render #${renderCount}:`, {
        fiberId: id,
        rootElement: root.current?.elementType?.name || 'Unknown',
        timestamp: new Date().toISOString()
      });
      
      // Call original handler if it exists
      if (originalOnCommitFiberRoot) {
        originalOnCommitFiberRoot.call(this, id, root, ...args);
      }
    };
    
    // Expose render debugging function
    window.debugReactRenders = function() {
      console.log(`📊 Total React renders since setup: ${renderCount}`);
      return renderCount;
    };
    
    console.log("✅ React DevTools profiling enabled");
  } else {
    console.warn("⚠️ React DevTools not found - install React Developer Tools extension");
    
    // Fallback render tracking using MutationObserver
    setupFallbackRenderTracking();
  }
}

/**
 * Fallback render tracking when React DevTools is not available
 */
function setupFallbackRenderTracking() {
  console.log("🔄 Setting up fallback render tracking...");
  
  let renderCount = 0;
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.getAttribute && 
              (node.getAttribute('data-react-root') || 
               node.querySelector('[data-react-root]'))) {
            renderCount++;
            console.log(`🔄 DOM Update #${renderCount}:`, {
              target: mutation.target.tagName,
              addedNodes: mutation.addedNodes.length,
              timestamp: new Date().toISOString()
            });
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  window.debugReactRenders = function() {
    console.log(`📊 Total DOM updates since setup: ${renderCount}`);
    return renderCount;
  };
  
  console.log("✅ Fallback render tracking enabled");
}

/**
 * Setup fetch request/response monitoring with detailed logging
 */
function setupFetchRequestMonitoring() {
  console.log("🌐 Setting up fetch request monitoring...");
  
  if (window.originalFetch) {
    console.warn("⚠️ Fetch monitoring already set up");
    return;
  }
  
  // Store original fetch
  window.originalFetch = window.fetch;
  let requestCount = 0;
  const requestLog = [];
  
  // Override fetch with monitoring
  window.fetch = function(...args) {
    requestCount++;
    const requestId = `req-${requestCount}`;
    const startTime = performance.now();
    
    console.log(`🌐 Fetch Request #${requestCount}:`, {
      id: requestId,
      url: args[0],
      options: args[1] || {},
      timestamp: new Date().toISOString()
    });
    
    return window.originalFetch.apply(this, args)
      .then(response => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        const logEntry = {
          id: requestId,
          url: args[0],
          status: response.status,
          duration: duration,
          headers: Object.fromEntries(response.headers.entries()),
          timestamp: new Date().toISOString()
        };
        
        requestLog.push(logEntry);
        
        console.log(`✅ Fetch Response #${requestCount}:`, {
          ...logEntry,
          ok: response.ok
        });
        
        return response;
      })
      .catch(error => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        const logEntry = {
          id: requestId,
          url: args[0],
          error: error.message,
          duration: duration,
          timestamp: new Date().toISOString()
        };
        
        requestLog.push(logEntry);
        
        console.error(`❌ Fetch Error #${requestCount}:`, logEntry);
        throw error;
      });
  };
  
  // Expose debugging functions
  window.debugFetchRequests = function() {
    console.log(`📊 Total fetch requests: ${requestCount}`);
    console.table(requestLog);
    return requestLog;
  };
  
  window.clearFetchLogs = function() {
    requestLog.length = 0;
    requestCount = 0;
    console.log("🧹 Fetch logs cleared");
  };
  
  console.log("✅ Fetch monitoring enabled");
}

/**
 * Setup state update tracking capability
 */
function setupStateUpdateTracking() {
  console.log("📊 Setting up state update tracking...");
  
  window.debugStateUpdates = true;
  let stateUpdateCount = 0;
  const stateUpdateLog = [];
  
  // Monitor localStorage changes
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    stateUpdateCount++;
    const logEntry = {
      type: 'localStorage',
      key: key,
      value: value.length > 100 ? `${value.substring(0, 100)}...` : value,
      timestamp: new Date().toISOString()
    };
    
    stateUpdateLog.push(logEntry);
    console.log(`💾 LocalStorage Update #${stateUpdateCount}:`, logEntry);
    
    return originalSetItem.call(this, key, value);
  };
  
  // Monitor sessionStorage changes
  const originalSessionSetItem = sessionStorage.setItem;
  sessionStorage.setItem = function(key, value) {
    stateUpdateCount++;
    const logEntry = {
      type: 'sessionStorage',
      key: key,
      value: value.length > 100 ? `${value.substring(0, 100)}...` : value,
      timestamp: new Date().toISOString()
    };
    
    stateUpdateLog.push(logEntry);
    console.log(`🗄️ SessionStorage Update #${stateUpdateCount}:`, logEntry);
    
    return originalSessionSetItem.call(this, key, value);
  };
  
  // Expose debugging function
  window.debugStateUpdates = function() {
    console.log(`📊 Total state updates: ${stateUpdateCount}`);
    console.table(stateUpdateLog);
    return stateUpdateLog;
  };
  
  console.log("✅ State update tracking enabled");
}

/**
 * Setup performance monitoring
 */
function setupPerformanceMonitoring() {
  console.log("⚡ Setting up performance monitoring...");
  
  const performanceMetrics = {
    startTime: performance.now(),
    initialMemory: performance.memory ? performance.memory.usedJSHeapSize : null,
    renderTimes: [],
    networkRequests: 0
  };
  
  // Monitor page load performance
  window.addEventListener('load', () => {
    const navigation = performance.getEntriesByType('navigation')[0];
    console.log("📈 Page Load Performance:", {
      domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
      loadComplete: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
      totalLoadTime: Math.round(navigation.loadEventEnd - navigation.fetchStart)
    });
  });
  
  // Expose performance debugging function
  window.debugPerformance = function() {
    const currentTime = performance.now();
    const currentMemory = performance.memory ? performance.memory.usedJSHeapSize : null;
    
    const metrics = {
      uptime: Math.round(currentTime - performanceMetrics.startTime),
      memoryUsage: currentMemory ? {
        current: Math.round(currentMemory / 1024 / 1024) + ' MB',
        initial: Math.round((performanceMetrics.initialMemory || 0) / 1024 / 1024) + ' MB',
        increase: Math.round((currentMemory - (performanceMetrics.initialMemory || 0)) / 1024 / 1024) + ' MB'
      } : 'Not available',
      domNodes: document.querySelectorAll('*').length,
      eventListeners: getEventListenerCount()
    };
    
    console.log("📈 Performance Metrics:", metrics);
    return metrics;
  };
  
  console.log("✅ Performance monitoring enabled");
}

/**
 * Get approximate event listener count
 */
function getEventListenerCount() {
  if (typeof getEventListeners === 'function') {
    const elements = document.querySelectorAll('*');
    let count = 0;
    elements.forEach(el => {
      const listeners = getEventListeners(el);
      count += Object.keys(listeners).length;
    });
    return count;
  }
  return 'Not available (Chrome DevTools required)';
}

/**
 * Setup error tracking
 */
function setupErrorTracking() {
  console.log("🚨 Setting up error tracking...");
  
  const errorLog = [];
  
  // Global error handler
  window.addEventListener('error', (event) => {
    const errorEntry = {
      type: 'JavaScript Error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: new Date().toISOString()
    };
    
    errorLog.push(errorEntry);
    console.error("🚨 JavaScript Error:", errorEntry);
  });
  
  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    const errorEntry = {
      type: 'Unhandled Promise Rejection',
      reason: event.reason,
      promise: event.promise,
      timestamp: new Date().toISOString()
    };
    
    errorLog.push(errorEntry);
    console.error("🚨 Unhandled Promise Rejection:", errorEntry);
  });
  
  // Expose error debugging function
  window.debugErrors = function() {
    console.log(`🚨 Total errors logged: ${errorLog.length}`);
    console.table(errorLog);
    return errorLog;
  };
  
  console.log("✅ Error tracking enabled");
}

/**
 * Clear all debug logs
 */
function clearDebugLogs() {
  if (window.clearFetchLogs) window.clearFetchLogs();
  console.clear();
  console.log("🧹 All debug logs cleared");
}

// Expose main functions globally
window.initializeDebuggingEnvironment = initializeDebuggingEnvironment;
window.clearDebugLogs = clearDebugLogs;

// Auto-initialize if in development environment
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log("🔧 Development environment detected - debugging tools ready");
  console.log("💡 Run 'initializeDebuggingEnvironment()' to start debugging");
}

export {
  initializeDebuggingEnvironment,
  setupReactDevToolsProfiler,
  setupFetchRequestMonitoring,
  setupStateUpdateTracking,
  setupPerformanceMonitoring,
  setupErrorTracking,
  clearDebugLogs
};