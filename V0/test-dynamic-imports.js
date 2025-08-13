#!/usr/bin/env node

// Test script to diagnose dynamic import issues
console.log('🔍 Testing dynamic imports...');

async function testImports() {
  try {
    console.log('1. Testing onboarding-screen import...');
    
    // Simulate the exact import that's failing
    try {
      const onboardingModule = await import('./components/onboarding-screen.js');
      console.log('✅ onboarding-screen import successful');
      console.log('Exports:', Object.keys(onboardingModule));
      
      if (onboardingModule.OnboardingScreen) {
        console.log('✅ OnboardingScreen export found');
      } else {
        console.log('❌ OnboardingScreen export NOT found');
        console.log('Available exports:', Object.keys(onboardingModule));
      }
    } catch (error) {
      console.log('❌ onboarding-screen import failed:', error.message);
    }
    
    console.log('\n2. Testing today-screen-min import...');
    try {
      const todayModule = await import('./components/today-screen-min.js');
      console.log('✅ today-screen-min import successful');
      console.log('Exports:', Object.keys(todayModule));
      
      if (todayModule.TodayScreen) {
        console.log('✅ TodayScreen export found');
      } else {
        console.log('❌ TodayScreen export NOT found');
      }
    } catch (error) {
      console.log('❌ today-screen-min import failed:', error.message);
    }
    
    console.log('\n3. Testing chunk-error-boundary import...');
    try {
      const chunkModule = await import('./components/chunk-error-boundary.js');
      console.log('✅ chunk-error-boundary import successful');
      console.log('Exports:', Object.keys(chunkModule));
    } catch (error) {
      console.log('❌ chunk-error-boundary import failed:', error.message);
    }
    
    console.log('\n4. Testing db import...');
    try {
      const dbModule = await import('./lib/db.js');
      console.log('✅ db import successful');
      console.log('Available exports:', Object.keys(dbModule));
    } catch (error) {
      console.log('❌ db import failed:', error.message);
    }
    
  } catch (globalError) {
    console.log('❌ Global test error:', globalError.message);
  }
}

testImports().then(() => {
  console.log('\n🎯 Dynamic import test completed');
}).catch(error => {
  console.log('\n💥 Test crashed:', error.message);
});