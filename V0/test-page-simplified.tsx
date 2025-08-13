'use client';

import { useState } from "react"
import dynamic from 'next/dynamic'

// Test the exact line that's causing the error
console.log('🔍 About to create dynamic import for OnboardingScreen...');

// This is line 5 from the original page.tsx that's causing the error
const OnboardingScreen = dynamic(() => {
  console.log('🔄 Dynamic import callback executing...');
  
  return import("@/components/onboarding-screen").then(m => {
    console.log('📦 Module loaded:', m);
    console.log('📦 Available exports:', Object.keys(m));
    
    if (!m.OnboardingScreen) {
      console.error('❌ OnboardingScreen export not found!');
      console.error('Available exports:', Object.keys(m));
      throw new Error('OnboardingScreen export not found');
    }
    
    console.log('✅ OnboardingScreen found in module');
    return m.OnboardingScreen;
  }).catch(error => {
    console.error('💥 Dynamic import failed:', error);
    throw error;
  });
}, { 
  ssr: false,
  loading: () => <div>Loading OnboardingScreen...</div>
});

console.log('✅ OnboardingScreen dynamic import created');

export default function TestPage() {
  const [showOnboarding, setShowOnboarding] = useState(true);
  
  console.log('🎭 TestPage rendering...');
  
  if (showOnboarding) {
    console.log('📱 Rendering OnboardingScreen...');
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative">
        <div className="p-4">
          <h1>Test Page - OnboardingScreen</h1>
          <button 
            onClick={() => setShowOnboarding(false)}
            className="mb-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Hide Onboarding
          </button>
          <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto relative">
      <div className="p-4">
        <h1>Test Page - Success</h1>
        <button 
          onClick={() => setShowOnboarding(true)}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Show Onboarding
        </button>
        <p>If you see this, the dynamic import worked correctly!</p>
      </div>
    </div>
  );
}