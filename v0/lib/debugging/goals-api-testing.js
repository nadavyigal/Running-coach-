/**
 * Goals API Frontend Integration Testing
 * 
 * This module provides comprehensive testing functions for the Goals API
 * integration including component state management, form validation,
 * and API response handling.
 */

/**
 * Test Goals API component state management and element detection
 */
function testGoalComponentStateManagement() {
  console.log("🎯 Testing Goals API Component State Management");
  
  const results = {
    elementsFound: {},
    componentsDetected: [],
    stateValidation: {},
    timestamp: new Date().toISOString()
  };
  
  // Search for goal-related elements
  const goalSelectors = [
    '[data-testid*="goal"]',
    '[class*="goal"]',
    '[id*="goal"]',
    'button:contains("goal")',
    'input[placeholder*="goal"]',
    '.goal-creation-wizard',
    '.goal-form',
    '.goal-modal'
  ];
  
  goalSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      results.elementsFound[selector] = elements.length;
      
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements for selector: ${selector}`);
        elements.forEach((el, index) => {
          console.log(`   - Element ${index + 1}:`, {
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            visible: el.offsetHeight > 0 && el.offsetWidth > 0
          });
        });
      }
    } catch (error) {
      console.warn(`⚠️ Selector error for ${selector}:`, error.message);
      results.elementsFound[selector] = 'error';
    }
  });
  
  // Check for React components in DevTools
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log("⚛️ Checking React components...");
    
    // Look for goal-related component names
    const goalComponentNames = [
      'GoalCreationWizard',
      'GoalForm',
      'GoalModal',
      'GoalList',
      'GoalProgress',
      'GoalCard'
    ];
    
    goalComponentNames.forEach(componentName => {
      // This is a simplified check - in practice, would need deeper React DevTools integration
      const hasComponent = document.querySelector(`[data-react-component*="${componentName}"]`) !== null;
      results.componentsDetected.push({
        name: componentName,
        detected: hasComponent
      });
    });
  }
  
  // Test for goal-related buttons and interactions
  const goalButtons = document.querySelectorAll('button');
  let goalRelatedButtons = 0;
  
  goalButtons.forEach(button => {
    const text = button.textContent?.toLowerCase() || '';
    if (text.includes('goal') || text.includes('create') || text.includes('target')) {
      goalRelatedButtons++;
      console.log(`🎯 Goal-related button found:`, {
        text: button.textContent,
        disabled: button.disabled,
        visible: button.offsetHeight > 0 && button.offsetWidth > 0
      });
    }
  });
  
  results.stateValidation.goalRelatedButtons = goalRelatedButtons;
  
  console.log("📊 Goal Component State Management Results:", results);
  return results;
}

/**
 * Test goal form state validation and input simulation
 */
function testGoalFormStateValidation() {
  console.log("📝 Testing Goal Form State Validation");
  
  const results = {
    formElements: {},
    inputTests: [],
    validationResults: {},
    timestamp: new Date().toISOString()
  };
  
  // Find goal form elements
  const formSelectors = [
    'form[data-testid*="goal"]',
    '.goal-form',
    '[class*="goal"] form',
    'form:has(input[placeholder*="goal"])',
    'form:has(button:contains("Create Goal"))'
  ];
  
  let targetForm = null;
  
  formSelectors.forEach(selector => {
    try {
      const forms = document.querySelectorAll(selector);
      if (forms.length > 0) {
        targetForm = forms[0];
        results.formElements[selector] = forms.length;
        console.log(`✅ Found goal form with selector: ${selector}`);
      }
    } catch (error) {
      console.warn(`⚠️ Form selector error for ${selector}:`, error.message);
    }
  });
  
  // If no specific goal form found, look for any forms
  if (!targetForm) {
    const allForms = document.querySelectorAll('form');
    if (allForms.length > 0) {
      targetForm = allForms[0];
      console.log("🔍 No specific goal form found, using first available form");
    }
  }
  
  if (targetForm) {
    console.log("📝 Testing form inputs...");
    
    // Test common input types
    const inputTests = [
      {
        selector: 'input[type="text"], input:not([type])',
        testValue: 'Test Goal Title',
        expectedBehavior: 'Should accept text input'
      },
      {
        selector: 'input[type="number"]',
        testValue: '100',
        expectedBehavior: 'Should accept numeric input'
      },
      {
        selector: 'select',
        testValue: null,
        expectedBehavior: 'Should have selectable options'
      },
      {
        selector: 'textarea',
        testValue: 'Test goal description with detailed information',
        expectedBehavior: 'Should accept multiline text'
      }
    ];
    
    inputTests.forEach(test => {
      const inputs = targetForm.querySelectorAll(test.selector);
      
      inputs.forEach((input, index) => {
        const testResult = {
          selector: test.selector,
          index: index,
          element: input.tagName,
          initialValue: input.value,
          placeholder: input.placeholder,
          required: input.required,
          disabled: input.disabled
        };
        
        // Simulate input if not disabled
        if (!input.disabled && test.testValue !== null) {
          try {
            input.focus();
            
            if (input.tagName === 'SELECT') {
              // Test select options
              testResult.options = Array.from(input.options).map(opt => ({
                value: opt.value,
                text: opt.textContent
              }));
              
              if (input.options.length > 1) {
                input.selectedIndex = 1;
                testResult.testResult = 'Option selected successfully';
              }
            } else {
              // Test text/number inputs
              input.value = test.testValue;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              
              testResult.testValue = test.testValue;
              testResult.finalValue = input.value;
              testResult.testResult = input.value === test.testValue ? 'Value set successfully' : 'Value set failed';
            }
            
            console.log(`✅ Input test completed:`, testResult);
          } catch (error) {
            testResult.testResult = `Error: ${error.message}`;
            console.warn(`⚠️ Input test failed:`, testResult);
          }
        } else {
          testResult.testResult = input.disabled ? 'Disabled' : 'No test value provided';
        }
        
        results.inputTests.push(testResult);
      });
    });
    
    // Test form submission button
    const submitButtons = targetForm.querySelectorAll('button[type="submit"], input[type="submit"]');
    results.validationResults.submitButtons = submitButtons.length;
    
    submitButtons.forEach((button, index) => {
      console.log(`🚀 Submit button ${index + 1}:`, {
        text: button.textContent || button.value,
        disabled: button.disabled,
        type: button.type
      });
    });
    
    // Test form validation
    if (targetForm.checkValidity) {
      results.validationResults.formValid = targetForm.checkValidity();
      console.log(`📋 Form validation status: ${results.validationResults.formValid ? 'Valid' : 'Invalid'}`);
    }
    
  } else {
    console.warn("❌ No forms found for testing");
    results.validationResults.error = "No forms found";
  }
  
  console.log("📊 Goal Form State Validation Results:", results);
  return results;
}

/**
 * Test API response handling and UI updates
 */
async function testGoalAPIResponseHandling() {
  console.log("🔄 Testing Goal API Response Handling");
  
  const results = {
    apiTests: [],
    uiUpdateTests: [],
    errorTests: [],
    timestamp: new Date().toISOString()
  };
  
  // Test direct API calls
  const apiEndpoints = [
    {
      url: '/api/goals',
      method: 'GET',
      params: '?userId=1&includeProgress=true',
      expectedResponse: 'goals array with progress data'
    },
    {
      url: '/api/goals',
      method: 'POST',
      body: {
        userId: 1,
        title: 'Test API Goal',
        goalType: 'time_improvement',
        category: 'speed',
        priority: 1,
        specificTarget: {
          metric: '5k_time',
          value: 1500,
          unit: 'seconds',
          description: 'Run 5K in under 25 minutes'
        },
        measurableMetrics: ['5k_time'],
        achievableAssessment: {
          currentLevel: 1800,
          targetLevel: 1500,
          feasibilityScore: 75,
          recommendedAdjustments: []
        },
        relevantContext: 'Test goal for API testing',
        timeBound: {
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          startDate: new Date().toISOString(),
          totalDuration: 30,
          milestoneSchedule: [25, 50, 75]
        },
        baselineValue: 1800,
        targetValue: 1500
      },
      expectedResponse: 'created goal object with milestones'
    }
  ];
  
  for (const endpoint of apiEndpoints) {
    try {
      console.log(`🌐 Testing ${endpoint.method} ${endpoint.url}${endpoint.params || ''}`);
      
      const fetchOptions = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      if (endpoint.body) {
        fetchOptions.body = JSON.stringify(endpoint.body);
      }
      
      const startTime = performance.now();
      const response = await fetch(endpoint.url + (endpoint.params || ''), fetchOptions);
      const endTime = performance.now();
      
      let responseData = null;
      let responseText = '';
      
      try {
        responseText = await response.text();
        if (responseText) {
          responseData = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.warn("⚠️ Response parsing failed:", parseError.message);
      }
      
      const testResult = {
        endpoint: endpoint.url,
        method: endpoint.method,
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        responseTime: Math.round(endTime - startTime),
        responseData: responseData,
        responseText: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
        expectedResponse: endpoint.expectedResponse
      };
      
      if (response.ok) {
        console.log(`✅ API test successful:`, testResult);
        
        // Validate response structure for GET requests
        if (endpoint.method === 'GET' && responseData) {
          testResult.validation = {
            hasGoals: Array.isArray(responseData.goals),
            hasSummary: !!responseData.summary,
            goalCount: responseData.goals?.length || 0
          };
        }
        
        // Validate response structure for POST requests  
        if (endpoint.method === 'POST' && responseData) {
          testResult.validation = {
            hasGoal: !!responseData.goal,
            hasProgress: !!responseData.progress,
            hasValidation: !!responseData.validation
          };
        }
      } else {
        console.warn(`⚠️ API test failed:`, testResult);
      }
      
      results.apiTests.push(testResult);
      
    } catch (error) {
      const errorResult = {
        endpoint: endpoint.url,
        method: endpoint.method,
        error: error.message,
        stack: error.stack
      };
      
      console.error(`❌ API test error:`, errorResult);
      results.errorTests.push(errorResult);
    }
  }
  
  // Test UI updates after API calls
  console.log("🎯 Testing UI updates after API responses...");
  
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for potential UI updates
  
  const uiElements = [
    { selector: '[class*="goal-"], [data-goal-id]', description: 'Goal display elements' },
    { selector: '.goal-list, [class*="goal-list"]', description: 'Goal list containers' },
    { selector: '.goal-card, [class*="goal-card"]', description: 'Goal card components' },
    { selector: '[class*="progress"], .progress', description: 'Progress indicators' }
  ];
  
  uiElements.forEach(element => {
    const elements = document.querySelectorAll(element.selector);
    const uiTest = {
      selector: element.selector,
      description: element.description,
      elementsFound: elements.length,
      elementsVisible: 0
    };
    
    elements.forEach(el => {
      if (el.offsetHeight > 0 && el.offsetWidth > 0) {
        uiTest.elementsVisible++;
      }
    });
    
    console.log(`🎯 UI Update Test - ${element.description}:`, uiTest);
    results.uiUpdateTests.push(uiTest);
  });
  
  console.log("📊 Goal API Response Handling Results:", results);
  return results;
}

/**
 * Test goal form submission with monitoring
 */
function testGoalFormSubmission() {
  console.log("🚀 Testing Goal Form Submission");
  
  const results = {
    formFound: false,
    submitButtonFound: false,
    submissionAttempted: false,
    networkActivityDetected: false,
    timestamp: new Date().toISOString()
  };
  
  // Find goal form and submit button
  const forms = document.querySelectorAll('form');
  let targetForm = null;
  let submitButton = null;
  
  // Look for goal-specific forms first
  forms.forEach(form => {
    const formText = form.textContent?.toLowerCase() || '';
    if (formText.includes('goal') || formText.includes('create') || formText.includes('target')) {
      targetForm = form;
      results.formFound = true;
      console.log("✅ Found goal-related form");
    }
  });
  
  // If no goal form found, use first form
  if (!targetForm && forms.length > 0) {
    targetForm = forms[0];
    results.formFound = true;
    console.log("🔍 Using first available form");
  }
  
  if (targetForm) {
    // Find submit button
    submitButton = targetForm.querySelector('button[type="submit"], input[type="submit"]') ||
                  targetForm.querySelector('button:not([type="button"])');
    
    if (submitButton) {
      results.submitButtonFound = true;
      console.log("✅ Found submit button:", {
        text: submitButton.textContent || submitButton.value,
        disabled: submitButton.disabled
      });
      
      // Monitor network activity
      let networkActivityCount = 0;
      const originalFetch = window.fetch;
      
      const networkMonitor = (...args) => {
        networkActivityCount++;
        console.log(`🌐 Network activity detected during form submission:`, args[0]);
        return originalFetch.apply(window, args);
      };
      
      if (!submitButton.disabled) {
        // Temporarily replace fetch to monitor
        window.fetch = networkMonitor;
        
        try {
          console.log("🚀 Attempting form submission...");
          submitButton.click();
          results.submissionAttempted = true;
          
          // Check for network activity after short delay
          setTimeout(() => {
            results.networkActivityDetected = networkActivityCount > 0;
            console.log(`📊 Network activity count: ${networkActivityCount}`);
            
            // Restore original fetch
            window.fetch = originalFetch;
          }, 2000);
          
        } catch (error) {
          console.error("❌ Form submission error:", error);
          results.submissionError = error.message;
          
          // Restore original fetch
          window.fetch = originalFetch;
        }
      } else {
        console.warn("⚠️ Submit button is disabled");
        results.submissionError = "Submit button disabled";
      }
    } else {
      console.warn("❌ No submit button found");
    }
  } else {
    console.warn("❌ No forms found");
  }
  
  console.log("📊 Goal Form Submission Results:", results);
  return results;
}

/**
 * Run comprehensive goals API testing suite
 */
async function runGoalsAPITestSuite() {
  console.log("🎯 Running Comprehensive Goals API Test Suite");
  console.log("=" .repeat(60));
  
  const startTime = performance.now();
  
  try {
    // Test 1: Component State Management
    console.log("\n1️⃣ Testing Component State Management...");
    const componentResults = testGoalComponentStateManagement();
    
    // Test 2: Form State Validation
    console.log("\n2️⃣ Testing Form State Validation...");
    const formResults = testGoalFormStateValidation();
    
    // Test 3: API Response Handling
    console.log("\n3️⃣ Testing API Response Handling...");
    const apiResults = await testGoalAPIResponseHandling();
    
    // Test 4: Form Submission
    console.log("\n4️⃣ Testing Form Submission...");
    const submissionResults = testGoalFormSubmission();
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    const summaryResults = {
      duration: duration,
      testsCompleted: 4,
      componentResults,
      formResults,
      apiResults,
      submissionResults,
      timestamp: new Date().toISOString()
    };
    
    console.log("\n📊 Goals API Test Suite Summary:");
    console.log("=" .repeat(60));
    console.log(`⏱️ Total execution time: ${duration}ms`);
    console.log(`✅ Tests completed: ${summaryResults.testsCompleted}`);
    console.log(`🎯 Component elements found: ${Object.values(componentResults.elementsFound).reduce((a, b) => typeof b === 'number' ? a + b : a, 0)}`);
    console.log(`📝 Form inputs tested: ${formResults.inputTests.length}`);
    console.log(`🌐 API endpoints tested: ${apiResults.apiTests.length}`);
    console.log(`🚀 Submission attempted: ${submissionResults.submissionAttempted}`);
    
    return summaryResults;
    
  } catch (error) {
    console.error("❌ Test suite error:", error);
    return { error: error.message, timestamp: new Date().toISOString() };
  }
}

// Expose functions globally for browser console access
window.testGoalComponentStateManagement = testGoalComponentStateManagement;
window.testGoalFormStateValidation = testGoalFormStateValidation;
window.testGoalAPIResponseHandling = testGoalAPIResponseHandling;
window.testGoalFormSubmission = testGoalFormSubmission;
window.runGoalsAPITestSuite = runGoalsAPITestSuite;

export {
  testGoalComponentStateManagement,
  testGoalFormStateValidation,
  testGoalAPIResponseHandling,
  testGoalFormSubmission,
  runGoalsAPITestSuite
};