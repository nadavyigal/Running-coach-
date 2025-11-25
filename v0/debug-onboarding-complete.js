// Complete Onboarding Debug Script
// Copy and paste this entire script into your browser console when on your app page

(function() {
    console.log('🔧 Starting comprehensive onboarding debug...');
    
    // Store original console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // Capture all errors
    const capturedErrors = [];
    const capturedWarnings = [];
    
    // Override console methods to capture errors
    console.error = function(...args) {
        capturedErrors.push({
            message: args.join(' '),
            timestamp: new Date().toISOString(),
            stack: new Error().stack
        });
        originalError.apply(console, args);
    };
    
    console.warn = function(...args) {
        capturedWarnings.push({
            message: args.join(' '),
            timestamp: new Date().toISOString()
        });
        originalWarn.apply(console, args);
    };
    
    // 1. Database Diagnostics
    async function diagnoseDatabase() {
        console.log('📊 === DATABASE DIAGNOSTICS ===');
        
        try {
            // Check if IndexedDB is available
            if (!window.indexedDB) {
                console.error('❌ IndexedDB not available');
                return false;
            }
            
            // Try to open the database
            const dbRequest = window.indexedDB.open('RunSmartDB');
            
            return new Promise((resolve) => {
                dbRequest.onsuccess = function(event) {
                    const db = event.target.result;
                    console.log('✅ Database opened successfully');
                    
                    // Check tables
                    const tables = Array.from(db.objectStoreNames);
                    console.log('📋 Available tables:', tables);
                    
                    // Check user count
                    if (tables.includes('users')) {
                        const transaction = db.transaction(['users'], 'readonly');
                        const userStore = transaction.objectStore('users');
                        const countRequest = userStore.count();
                        
                        countRequest.onsuccess = function() {
                            console.log(`👥 Users in database: ${countRequest.result}`);
                            db.close();
                            resolve(true);
                        };
                        
                        countRequest.onerror = function() {
                            console.error('❌ Error counting users');
                            db.close();
                            resolve(false);
                        };
                    } else {
                        console.log('⚠️ No users table found');
                        db.close();
                        resolve(false);
                    }
                };
                
                dbRequest.onerror = function(event) {
                    console.error('❌ Database open error:', event.target.error);
                    resolve(false);
                };
                
                dbRequest.onupgradeneeded = function(event) {
                    console.log('🔄 Database upgrade needed');
                };
            });
            
        } catch (error) {
            console.error('❌ Database diagnosis error:', error);
            return false;
        }
    }
    
    // 2. LocalStorage Diagnostics
    function diagnoseLocalStorage() {
        console.log('💾 === LOCALSTORAGE DIAGNOSTICS ===');
        
        const keys = Object.keys(localStorage);
        console.log('📋 Total localStorage keys:', keys.length);
        
        const onboardingKeys = keys.filter(key => 
            key.includes('onboarding') || 
            key.includes('user') || 
            key.includes('plan') ||
            key.includes('db') ||
            key.includes('dexie')
        );
        
        console.log('🎯 Onboarding-related keys:', onboardingKeys);
        
        onboardingKeys.forEach(key => {
            try {
                const value = localStorage.getItem(key);
                console.log(`  ${key}: ${value ? value.substring(0, 100) + '...' : 'null'}`);
            } catch (e) {
                console.error(`  Error reading ${key}:`, e);
            }
        });
        
        return onboardingKeys.length;
    }
    
    // 3. React Component Diagnostics
    function diagnoseReactComponents() {
        console.log('⚛️ === REACT COMPONENT DIAGNOSTICS ===');
        
        // Look for error boundaries
        const errorBoundaries = document.querySelectorAll('[data-error-boundary], [class*="error"], [class*="Error"]');
        console.log(`🛡️ Error boundaries found: ${errorBoundaries.length}`);
        
        // Look for error states
        const errorElements = document.querySelectorAll('[data-error], .error, [role="alert"], [class*="error"]');
        console.log(`⚠️ Error elements found: ${errorElements.length}`);
        
        errorElements.forEach((element, index) => {
            console.log(`Error element ${index + 1}:`, {
                tagName: element.tagName,
                className: element.className,
                textContent: element.textContent?.substring(0, 100),
                attributes: Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ')
            });
        });
        
        // Check for React DevTools
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            console.log('✅ React DevTools detected');
        } else {
            console.log('⚠️ React DevTools not detected');
        }
        
        return errorElements.length;
    }
    
    // 4. Network Diagnostics
    function diagnoseNetwork() {
        console.log('🌐 === NETWORK DIAGNOSTICS ===');
        
        // Check if we're online
        console.log('📡 Online status:', navigator.onLine);
        
        // Check for failed requests
        const failedRequests = performance.getEntriesByType('resource')
            .filter(entry => entry.initiatorType === 'xmlhttprequest' && entry.responseEnd === 0);
        
        console.log(`❌ Failed network requests: ${failedRequests.length}`);
        failedRequests.forEach((request, index) => {
            console.log(`  Failed request ${index + 1}: ${request.name}`);
        });
        
        return failedRequests.length;
    }
    
    // 5. Performance Diagnostics
    function diagnosePerformance() {
        console.log('⚡ === PERFORMANCE DIAGNOSTICS ===');
        
        const perfEntries = performance.getEntriesByType('navigation')[0];
        if (perfEntries) {
            console.log('📊 Page load metrics:');
            console.log(`  - DOM Content Loaded: ${perfEntries.domContentLoadedEventEnd - perfEntries.domContentLoadedEventStart}ms`);
            console.log(`  - Load Complete: ${perfEntries.loadEventEnd - perfEntries.loadEventStart}ms`);
            console.log(`  - Total Load Time: ${perfEntries.loadEventEnd - perfEntries.fetchStart}ms`);
        }
        
        // Check memory usage
        if (performance.memory) {
            console.log('🧠 Memory usage:');
            console.log(`  - Used: ${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB`);
            console.log(`  - Total: ${Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)}MB`);
            console.log(`  - Limit: ${Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)}MB`);
        }
    }
    
    // 6. Fix Functions
    async function clearAllData() {
        console.log('🧹 === CLEARING ALL DATA ===');
        
        // Clear localStorage
        const keysToRemove = [
            'onboardingComplete', 'currentUser', 'userPreferences', 'onboardingStep', 'onboardingData',
            'dexie', 'RunSmartDB', 'user', 'plan', 'workout', 'run', 'goal', 'badge', 'cohort',
            'performance', 'analytics', 'session', 'auth', 'token', 'preferences', 'settings'
        ];
        
        let clearedCount = 0;
        keysToRemove.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                clearedCount++;
                console.log(`🗑️ Removed: ${key}`);
            }
        });
        
        console.log(`✅ Cleared ${clearedCount} localStorage items`);
        
        // Clear sessionStorage
        sessionStorage.clear();
        console.log('🗑️ Cleared sessionStorage');
        
        // Clear IndexedDB
        try {
            const deleteRequest = window.indexedDB.deleteDatabase('RunSmartDB');
            deleteRequest.onsuccess = function() {
                console.log('✅ Database deleted successfully');
            };
            deleteRequest.onerror = function() {
                console.error('❌ Failed to delete database');
            };
        } catch (error) {
            console.error('❌ Error deleting database:', error);
        }
        
        return clearedCount;
    }
    
    async function resetOnboarding() {
        console.log('🔄 === RESETTING ONBOARDING ===');
        
        // Clear data
        await clearAllData();
        
        // Force page reload
        console.log('🔄 Reloading page...');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
    
    // 7. Main diagnostic function
    async function runFullDiagnosis() {
        console.log('🔍 === FULL ONBOARDING DIAGNOSIS ===');
        console.log('='.repeat(60));
        
        const results = {
            database: await diagnoseDatabase(),
            localStorage: diagnoseLocalStorage(),
            react: diagnoseReactComponents(),
            network: diagnoseNetwork(),
            performance: diagnosePerformance()
        };
        
        console.log('='.repeat(60));
        console.log('📋 DIAGNOSIS SUMMARY:');
        console.log(`  Database: ${results.database ? '✅ OK' : '❌ Issues'}`);
        console.log(`  LocalStorage: ${results.localStorage} items found`);
        console.log(`  React Errors: ${results.react} error elements`);
        console.log(`  Network Issues: ${results.network} failed requests`);
        console.log(`  Captured Errors: ${capturedErrors.length}`);
        console.log(`  Captured Warnings: ${capturedWarnings.length}`);
        
        if (capturedErrors.length > 0) {
            console.log('\n🚨 CAPTURED ERRORS:');
            capturedErrors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.message}`);
            });
        }
        
        if (capturedWarnings.length > 0) {
            console.log('\n⚠️ CAPTURED WARNINGS:');
            capturedWarnings.forEach((warning, index) => {
                console.log(`${index + 1}. ${warning.message}`);
            });
        }
        
        console.log('\n💡 RECOMMENDATIONS:');
        if (results.database === false) {
            console.log('  - Database issues detected. Try resetting the database.');
        }
        if (results.localStorage > 0) {
            console.log('  - Old localStorage data found. Consider clearing it.');
        }
        if (results.react > 0) {
            console.log('  - React errors detected. Check component state.');
        }
        if (capturedErrors.length > 10) {
            console.log('  - Many errors detected. Consider a full reset.');
        }
        
        return results;
    }
    
    // 8. Export functions to window for manual use
    window.debugOnboarding = {
        diagnose: runFullDiagnosis,
        clearData: clearAllData,
        reset: resetOnboarding,
        checkDatabase: diagnoseDatabase,
        checkStorage: diagnoseLocalStorage,
        checkReact: diagnoseReactComponents,
        checkNetwork: diagnoseNetwork,
        checkPerformance: diagnosePerformance,
        errors: capturedErrors,
        warnings: capturedWarnings
    };
    
    // Auto-run diagnosis after a short delay
    setTimeout(() => {
        console.log('🔧 Onboarding Debug Tool Loaded');
        console.log('📋 Available functions:');
        console.log('  - debugOnboarding.diagnose() - Run full diagnosis');
        console.log('  - debugOnboarding.clearData() - Clear all data');
        console.log('  - debugOnboarding.reset() - Reset and reload');
        console.log('  - debugOnboarding.errors - View captured errors');
        console.log('  - debugOnboarding.warnings - View captured warnings');
        
        // Auto-run diagnosis
        runFullDiagnosis();
    }, 1000);
    
})(); 