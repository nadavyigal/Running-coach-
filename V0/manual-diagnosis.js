// Manual diagnosis script for the running coach application
console.log('🔍 Starting manual diagnosis...');

// Function to test the application manually
async function diagnoseApp() {
    const results = {
        pageLoad: {},
        onboarding: {},
        navigation: {},
        chat: {},
        issues: []
    };
    
    console.log('📋 Testing page load...');
    
    // Test 1: Check if page loads without errors
    try {
        const response = await fetch('http://localhost:3004');
        results.pageLoad.status = response.status;
        results.pageLoad.ok = response.ok;
        
        const html = await response.text();
        results.pageLoad.hasContent = html.length > 1000;
        results.pageLoad.hasLoadingScreen = html.includes('Loading RunSmart');
        results.pageLoad.hasReactRoot = html.includes('__next');
        
        console.log('✅ Page load test complete:', results.pageLoad);
    } catch (error) {
        results.pageLoad.error = error.message;
        results.issues.push('Page failed to load: ' + error.message);
    }
    
    // Test 2: Check localStorage and onboarding state
    console.log('📋 Testing onboarding state...');
    try {
        // Simulate browser environment check
        if (typeof localStorage !== 'undefined') {
            const onboardingComplete = localStorage.getItem('onboarding-complete');
            const userData = localStorage.getItem('user-data');
            
            results.onboarding.isComplete = onboardingComplete === 'true';
            results.onboarding.hasUserData = !!userData;
            
            if (userData) {
                try {
                    results.onboarding.userData = JSON.parse(userData);
                } catch {
                    results.onboarding.userData = 'invalid JSON';
                }
            }
        }
        
        console.log('✅ Onboarding state test complete:', results.onboarding);
    } catch (error) {
        results.onboarding.error = error.message;
        results.issues.push('Onboarding state check failed: ' + error.message);
    }
    
    // Test 3: Simulate button click
    console.log('📋 Testing button functionality...');
    try {
        // This would need to be run in browser context
        results.navigation.note = 'Button test requires browser context';
    } catch (error) {
        results.navigation.error = error.message;
    }
    
    // Generate diagnosis report
    console.log('📊 Diagnosis Results:', JSON.stringify(results, null, 2));
    
    // Generate fix recommendations
    const fixes = [];
    
    if (!results.pageLoad.ok) {
        fixes.push('1. Fix server startup - app not responding on port 3004');
    }
    
    if (results.pageLoad.hasLoadingScreen && !results.onboarding.isComplete) {
        fixes.push('2. Loading state may be stuck - check database initialization');
    }
    
    if (!results.onboarding.hasUserData) {
        fixes.push('3. No user data found - onboarding may not be creating proper user data');
    }
    
    if (results.issues.length === 0) {
        fixes.push('4. Consider enabling debug mode with Ctrl+Shift+D in browser');
        fixes.push('5. Check browser console for React/JavaScript errors');
        fixes.push('6. Verify database operations are working correctly');
    }
    
    console.log('🔧 Recommended fixes:');
    fixes.forEach(fix => console.log(fix));
    
    return { results, fixes };
}

// Run diagnosis if in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = diagnoseApp;
    
    // Run if called directly
    if (require.main === module) {
        diagnoseApp().then(diagnosis => {
            console.log('📈 Diagnosis complete');
            process.exit(0);
        }).catch(error => {
            console.error('❌ Diagnosis failed:', error);
            process.exit(1);
        });
    }
}