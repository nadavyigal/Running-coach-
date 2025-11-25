// Manual test to verify onboarding completion
// Run this in browser console on http://localhost:3002

console.log('🧪 Starting manual onboarding test...');

// Function to simulate onboarding completion
function simulateOnboardingCompletion() {
    console.log('🎯 Simulating onboarding completion...');
    
    // Clear any existing localStorage
    localStorage.clear();
    console.log('✅ Cleared localStorage');
    
    // Create user data
    const userData = {
        experience: 'beginner',
        goal: 'habit',
        daysPerWeek: 3,
        preferredTimes: ['morning'],
        age: 30,
        motivations: ['health'],
        barriers: ['time'],
        coachingStyle: 'supportive'
    };
    
    // Set localStorage items
    localStorage.setItem('user-data', JSON.stringify(userData));
    localStorage.setItem('onboarding-complete', 'true');
    
    console.log('✅ Set localStorage items:', {
        'onboarding-complete': localStorage.getItem('onboarding-complete'),
        'user-data-length': localStorage.getItem('user-data')?.length
    });
    
    // Reload page to trigger state change
    console.log('🔄 Reloading page...');
    window.location.reload();
}

// Function to check current state
function checkCurrentState() {
    console.log('📊 Current state:', {
        url: window.location.href,
        localStorage: {
            'onboarding-complete': localStorage.getItem('onboarding-complete'),
            'user-data': localStorage.getItem('user-data')
        },
        bodyContent: document.body.innerText.substring(0, 200) + '...'
    });
}

// Function to click the onboarding button
function clickOnboardingButton() {
    const button = document.querySelector('button');
    if (button) {
        console.log('🔘 Found button with text:', button.textContent);
        console.log('👆 Clicking button...');
        button.click();
    } else {
        console.log('❌ No button found on page');
    }
}

// Export functions to global scope for manual testing
window.testOnboarding = {
    simulate: simulateOnboardingCompletion,
    check: checkCurrentState,
    click: clickOnboardingButton
};

console.log('✅ Test functions available as window.testOnboarding');
console.log('Available commands:');
console.log('  window.testOnboarding.check() - Check current state');
console.log('  window.testOnboarding.click() - Click onboarding button');
console.log('  window.testOnboarding.simulate() - Simulate completion manually');

// Run initial check
checkCurrentState();