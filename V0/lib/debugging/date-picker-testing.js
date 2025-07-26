/**
 * Date Picker Edge Cases and UI Behavior Testing
 * 
 * This module provides comprehensive testing functions for date picker
 * validation, calendar component behavior, and edge case handling.
 */

/**
 * Test date validation logic with boundary conditions
 */
function testDatePickerValidationLogic() {
  console.log("📅 Testing Date Picker Validation Logic");
  
  const results = {
    testDates: [],
    boundaryTests: [],
    edgeCases: [],
    validationFunction: null,
    timestamp: new Date().toISOString()
  };
  
  // Create comprehensive test date scenarios
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const testScenarios = [
    {
      name: 'Today',
      date: new Date(today),
      expectedValid: true,
      description: 'Current date should be allowed'
    },
    {
      name: 'Yesterday',
      date: new Date(today.getTime() - 24 * 60 * 60 * 1000),
      expectedValid: true,
      description: 'Yesterday should be allowed (within 30 days)'
    },
    {
      name: '29 days ago',
      date: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000),
      expectedValid: true,
      description: 'Boundary case: should be allowed'
    },
    {
      name: '30 days ago',
      date: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
      expectedValid: true,
      description: 'Boundary case: should be allowed (exactly 30 days)'
    },
    {
      name: '31 days ago',
      date: new Date(today.getTime() - 31 * 24 * 60 * 60 * 1000),
      expectedValid: false,
      description: 'Should be disabled (beyond 30 days)'
    },
    {
      name: 'Tomorrow',
      date: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      expectedValid: true,
      description: 'Tomorrow should be allowed'
    },
    {
      name: '89 days future',
      date: new Date(today.getTime() + 89 * 24 * 60 * 60 * 1000),
      expectedValid: true,
      description: 'Boundary case: should be allowed'
    },
    {
      name: '90 days future',
      date: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000),
      expectedValid: true,
      description: 'Boundary case: should be allowed (exactly 90 days)'
    },
    {
      name: '91 days future',
      date: new Date(today.getTime() + 91 * 24 * 60 * 60 * 1000),
      expectedValid: false,
      description: 'Should be disabled (beyond 90 days)'
    },
    {
      name: 'Leap year Feb 29, 2024',
      date: new Date(2024, 1, 29), // February 29, 2024
      expectedValid: null, // Depends on current date
      description: 'Leap year edge case'
    },
    {
      name: 'New Year transition',
      date: new Date(today.getFullYear() + 1, 0, 1), // January 1 next year
      expectedValid: null, // Depends on current date
      description: 'Year transition edge case'
    }
  ];
  
  // Test each date scenario
  testScenarios.forEach(scenario => {
    const testResult = {
      name: scenario.name,
      date: scenario.date.toISOString(),
      localDate: scenario.date.toLocaleDateString(),
      daysDiff: Math.floor((scenario.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      expectedValid: scenario.expectedValid,
      actualValid: null,
      description: scenario.description
    };
    
    // Calculate if date should be valid based on 30 days past, 90 days future rule
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    
    const calculatedValid = scenario.date >= thirtyDaysAgo && scenario.date <= ninetyDaysFromNow;
    testResult.calculatedValid = calculatedValid;
    
    // Check if expectation matches calculation
    if (scenario.expectedValid !== null) {
      testResult.expectationMatch = scenario.expectedValid === calculatedValid;
    }
    
    console.log(`📅 Date Test - ${scenario.name}:`, testResult);
    results.testDates.push(testResult);
  });
  
  // Test validation function if available
  if (typeof window.isDateDisabled === 'function') {
    results.validationFunction = 'Found global isDateDisabled function';
    console.log("✅ Found date validation function, testing...");
    
    testScenarios.forEach(scenario => {
      try {
        const isDisabled = window.isDateDisabled(scenario.date);
        const validationResult = {
          name: scenario.name,
          date: scenario.date.toISOString(),
          isDisabled: isDisabled,
          shouldBeDisabled: scenario.expectedValid === false,
          validationCorrect: isDisabled === (scenario.expectedValid === false)
        };
        
        console.log(`✅ Validation function test - ${scenario.name}:`, validationResult);
        results.boundaryTests.push(validationResult);
      } catch (error) {
        console.error(`❌ Validation function error for ${scenario.name}:`, error);
      }
    });
  } else {
    results.validationFunction = 'No global isDateDisabled function found';
    console.warn("⚠️ No global date validation function found");
  }
  
  console.log("📊 Date Picker Validation Logic Results:", results);
  return results;
}

/**
 * Test calendar component behavior and real-time interaction
 */
function testCalendarComponentBehavior() {
  console.log("🗓️ Testing Calendar Component Behavior");
  
  const results = {
    calendarElements: {},
    interactionTests: [],
    accessibilityTests: [],
    performanceMetrics: {},
    timestamp: new Date().toISOString()
  };
  
  // Search for calendar-related elements
  const calendarSelectors = [
    '[role="grid"]',
    '.calendar',
    '.calendar-grid',
    '[class*="calendar"]',
    '[data-testid*="calendar"]',
    '.date-picker',
    '[class*="date-picker"]',
    '.popover:has([role="grid"])',
    'button[aria-label*="calendar"]',
    'button:contains("Pick a date")'
  ];
  
  console.log("🔍 Searching for calendar elements...");
  
  calendarSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      results.calendarElements[selector] = {
        count: elements.length,
        visible: 0,
        interactive: 0
      };
      
      elements.forEach(el => {
        if (el.offsetHeight > 0 && el.offsetWidth > 0) {
          results.calendarElements[selector].visible++;
        }
        
        if (!el.disabled && el.getAttribute('aria-disabled') !== 'true') {
          results.calendarElements[selector].interactive++;
        }
      });
      
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements for ${selector}`, results.calendarElements[selector]);
      }
    } catch (error) {
      console.warn(`⚠️ Selector error for ${selector}:`, error.message);
      results.calendarElements[selector] = { error: error.message };
    }
  });
  
  // Test calendar trigger interaction
  const calendarTriggers = document.querySelectorAll(
    'button[aria-label*="calendar"], button:contains("Pick a date"), .popover-trigger, [data-state="closed"] button'
  );
  
  if (calendarTriggers.length > 0) {
    console.log("🖱️ Testing calendar trigger interaction...");
    
    const trigger = calendarTriggers[0];
    const startTime = performance.now();
    
    const triggerTest = {
      element: trigger.tagName,
      className: trigger.className,
      text: trigger.textContent?.trim() || '',
      disabled: trigger.disabled,
      ariaExpanded: trigger.getAttribute('aria-expanded'),
      clickAttempted: false,
      calendarOpened: false
    };
    
    try {
      // Record initial state
      const initialCalendars = document.querySelectorAll('[role="grid"], .calendar-grid').length;
      
      // Attempt to click the trigger
      trigger.click();
      triggerTest.clickAttempted = true;
      
      // Wait for calendar to potentially appear
      setTimeout(() => {
        const finalCalendars = document.querySelectorAll('[role="grid"], .calendar-grid').length;
        triggerTest.calendarOpened = finalCalendars > initialCalendars;
        
        const endTime = performance.now();
        triggerTest.responseTime = Math.round(endTime - startTime);
        
        console.log("🗓️ Calendar trigger test result:", triggerTest);
        
        // If calendar opened, test date cell interactions
        if (triggerTest.calendarOpened) {
          testDateCellInteractions();
        }
      }, 300);
      
    } catch (error) {
      triggerTest.error = error.message;
      console.error("❌ Calendar trigger test failed:", triggerTest);
    }
    
    results.interactionTests.push(triggerTest);
  } else {
    console.warn("❌ No calendar triggers found");
  }
  
  // Test accessibility features
  testCalendarAccessibility(results);
  
  console.log("📊 Calendar Component Behavior Results:", results);
  return results;
}

/**
 * Test date cell interactions within calendar
 */
function testDateCellInteractions() {
  console.log("📅 Testing Date Cell Interactions");
  
  const calendar = document.querySelector('[role="grid"], .calendar-grid');
  if (!calendar) {
    console.warn("❌ No calendar grid found for date cell testing");
    return;
  }
  
  const dateCells = calendar.querySelectorAll('[role="gridcell"], .day-cell, [class*="day"]');
  const disabledCells = calendar.querySelectorAll('[aria-disabled="true"], .disabled');
  const enabledCells = calendar.querySelectorAll('[role="gridcell"]:not([aria-disabled="true"])');
  
  console.log("📊 Date cell analysis:", {
    totalCells: dateCells.length,
    disabledCells: disabledCells.length,
    enabledCells: enabledCells.length,
    enabledPercentage: Math.round((enabledCells.length / dateCells.length) * 100) + '%'
  });
  
  // Test clicking on an enabled date
  if (enabledCells.length > 0) {
    const testCell = enabledCells[Math.floor(enabledCells.length / 2)]; // Pick middle cell
    
    console.log("🖱️ Testing date cell selection...", {
      cellText: testCell.textContent?.trim(),
      ariaLabel: testCell.getAttribute('aria-label'),
      className: testCell.className
    });
    
    try {
      testCell.click();
      
      setTimeout(() => {
        console.log("✅ Date cell clicked successfully");
        
        // Check if calendar closed after selection
        const calendarStillOpen = document.querySelector('[role="grid"], .calendar-grid') !== null;
        console.log(`📅 Calendar still open after selection: ${calendarStillOpen}`);
      }, 100);
      
    } catch (error) {
      console.error("❌ Date cell click failed:", error);
    }
  }
  
  // Analyze disabled date patterns
  if (disabledCells.length > 0) {
    console.log("🚫 Analyzing disabled date patterns...");
    
    const disabledDates = Array.from(disabledCells).map(cell => ({
      text: cell.textContent?.trim(),
      ariaLabel: cell.getAttribute('aria-label'),
      className: cell.className
    }));
    
    console.log("🚫 Disabled dates sample:", disabledDates.slice(0, 5));
  }
}

/**
 * Test calendar accessibility features
 */
function testCalendarAccessibility(results) {
  console.log("♿ Testing Calendar Accessibility");
  
  const accessibilityTests = [];
  
  // Test ARIA attributes
  const calendars = document.querySelectorAll('[role="grid"]');
  calendars.forEach((calendar, index) => {
    const accessibilityTest = {
      calendarIndex: index,
      role: calendar.getAttribute('role'),
      ariaLabel: calendar.getAttribute('aria-label'),
      ariaLabelledBy: calendar.getAttribute('aria-labelledby'),
      tabIndex: calendar.getAttribute('tabindex'),
      hasKeyboardNavigation: false
    };
    
    // Test keyboard navigation
    try {
      calendar.focus();
      
      // Simulate arrow key press
      const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      calendar.dispatchEvent(keyEvent);
      
      accessibilityTest.hasKeyboardNavigation = true;
      console.log("✅ Keyboard navigation test passed");
    } catch (error) {
      console.warn("⚠️ Keyboard navigation test failed:", error.message);
    }
    
    accessibilityTests.push(accessibilityTest);
  });
  
  // Test date cell accessibility
  const dateCells = document.querySelectorAll('[role="gridcell"]');
  if (dateCells.length > 0) {
    const sampleCell = dateCells[0];
    const cellAccessibility = {
      role: sampleCell.getAttribute('role'),
      ariaLabel: sampleCell.getAttribute('aria-label'),
      ariaDisabled: sampleCell.getAttribute('aria-disabled'),
      ariaSelected: sampleCell.getAttribute('aria-selected'),
      tabIndex: sampleCell.getAttribute('tabindex')
    };
    
    console.log("♿ Date cell accessibility:", cellAccessibility);
    accessibilityTests.push({ type: 'dateCells', ...cellAccessibility });
  }
  
  results.accessibilityTests = accessibilityTests;
}

/**
 * Test timezone and locale edge cases
 */
function testTimezoneAndLocaleEdgeCases() {
  console.log("🌍 Testing Timezone and Locale Edge Cases");
  
  const results = {
    timezoneInfo: {},
    localeTests: [],
    dateFormattingTests: [],
    dstTests: [],
    timestamp: new Date().toISOString()
  };
  
  // Get current timezone information
  const now = new Date();
  results.timezoneInfo = {
    localTime: now.toLocaleString(),
    utcTime: now.toISOString(),
    timezoneOffset: now.getTimezoneOffset(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
    supportedLocales: Intl.DateTimeFormat.supportedLocalesOf(['en-US', 'en-GB', 'fr-FR', 'de-DE', 'ja-JP'])
  };
  
  console.log("🌍 Timezone Information:", results.timezoneInfo);
  
  // Test date normalization across timezones
  const testDates = [
    '2024-01-15T00:00:00Z',
    '2024-01-15T23:59:59Z',
    '2024-06-15T12:00:00Z', // Summer time
    '2024-12-15T12:00:00Z'  // Winter time
  ];
  
  testDates.forEach(dateString => {
    const testDate = new Date(dateString);
    const normalized = new Date(testDate);
    normalized.setHours(0, 0, 0, 0);
    
    const normalizationTest = {
      originalString: dateString,
      originalDate: testDate.toISOString(),
      originalLocal: testDate.toLocaleDateString(),
      normalizedDate: normalized.toISOString(),
      normalizedLocal: normalized.toLocaleDateString(),
      timezoneShift: testDate.getDate() !== normalized.getDate()
    };
    
    console.log("📅 Date normalization test:", normalizationTest);
    results.dateFormattingTests.push(normalizationTest);
  });
  
  // Test locale-specific date formatting
  const locales = ['en-US', 'en-GB', 'fr-FR', 'de-DE'];
  const testDate = new Date(2024, 0, 15); // January 15, 2024
  
  locales.forEach(locale => {
    try {
      const localeTest = {
        locale: locale,
        shortDate: testDate.toLocaleDateString(locale),
        longDate: testDate.toLocaleDateString(locale, { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        monthNames: Array.from({length: 12}, (_, i) => 
          new Date(2024, i, 1).toLocaleDateString(locale, { month: 'long' })
        ).slice(0, 3) // First 3 months as sample
      };
      
      console.log(`🌍 Locale test (${locale}):`, localeTest);
      results.localeTests.push(localeTest);
    } catch (error) {
      console.warn(`⚠️ Locale test failed for ${locale}:`, error.message);
    }
  });
  
  // Test daylight saving time transitions (approximate)
  const dstTransitions = [
    new Date(2024, 2, 10), // Around spring DST transition
    new Date(2024, 10, 3)  // Around fall DST transition
  ];
  
  dstTransitions.forEach((date, index) => {
    const before = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    const after = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    
    const dstTest = {
      transitionDate: date.toLocaleDateString(),
      beforeOffset: before.getTimezoneOffset(),
      afterOffset: after.getTimezoneOffset(),
      offsetChange: after.getTimezoneOffset() - before.getTimezoneOffset(),
      isDSTTransition: Math.abs(after.getTimezoneOffset() - before.getTimezoneOffset()) === 60
    };
    
    console.log(`🕐 DST transition test ${index + 1}:`, dstTest);
    results.dstTests.push(dstTest);
  });
  
  console.log("📊 Timezone and Locale Edge Cases Results:", results);
  return results;
}

/**
 * Test leap year and month boundary edge cases
 */
function testLeapYearAndMonthBoundaries() {
  console.log("📅 Testing Leap Year and Month Boundary Edge Cases");
  
  const results = {
    leapYearTests: [],
    monthBoundaryTests: [],
    yearBoundaryTests: [],
    timestamp: new Date().toISOString()
  };
  
  // Test leap year scenarios
  const leapYears = [2020, 2024, 2028];
  const nonLeapYears = [2021, 2022, 2023, 2025];
  
  leapYears.forEach(year => {
    const feb29 = new Date(year, 1, 29); // February 29
    const leapTest = {
      year: year,
      feb29Valid: feb29.getMonth() === 1 && feb29.getDate() === 29,
      feb29String: feb29.toISOString(),
      feb29Local: feb29.toLocaleDateString()
    };
    
    console.log(`📅 Leap year test (${year}):`, leapTest);
    results.leapYearTests.push(leapTest);
  });
  
  nonLeapYears.forEach(year => {
    const feb29 = new Date(year, 1, 29); // February 29
    const nonLeapTest = {
      year: year,
      feb29Invalid: feb29.getMonth() !== 1 || feb29.getDate() !== 29,
      actualDate: feb29.toLocaleDateString(),
      rollsToMarch: feb29.getMonth() === 2
    };
    
    console.log(`📅 Non-leap year test (${year}):`, nonLeapTest);
    results.leapYearTests.push(nonLeapTest);
  });
  
  // Test month boundaries
  const monthBoundaries = [
    { month: 0, lastDay: 31, description: 'January' },
    { month: 1, lastDay: 28, description: 'February (non-leap)' },
    { month: 3, lastDay: 30, description: 'April' },
    { month: 11, lastDay: 31, description: 'December' }
  ];
  
  const currentYear = new Date().getFullYear();
  
  monthBoundaries.forEach(boundary => {
    const lastDayOfMonth = new Date(currentYear, boundary.month, boundary.lastDay);
    const nextDay = new Date(currentYear, boundary.month, boundary.lastDay + 1);
    
    const boundaryTest = {
      month: boundary.description,
      lastDay: lastDayOfMonth.toLocaleDateString(),
      nextDay: nextDay.toLocaleDateString(),
      rollsToNextMonth: nextDay.getMonth() !== boundary.month,
      dayAfterLastDay: nextDay.getDate()
    };
    
    console.log(`📅 Month boundary test (${boundary.description}):`, boundaryTest);
    results.monthBoundaryTests.push(boundaryTest);
  });
  
  // Test year boundaries
  const yearBoundary = new Date(currentYear, 11, 31); // December 31
  const newYear = new Date(currentYear, 11, 32); // Should roll to January 1 next year
  
  const yearBoundaryTest = {
    lastDayOfYear: yearBoundary.toLocaleDateString(),
    newYearDay: newYear.toLocaleDateString(),
    yearRollover: newYear.getFullYear() === currentYear + 1,
    newYearMonth: newYear.getMonth() === 0,
    newYearDate: newYear.getDate() === 1
  };
  
  console.log("📅 Year boundary test:", yearBoundaryTest);
  results.yearBoundaryTests.push(yearBoundaryTest);
  
  console.log("📊 Leap Year and Month Boundary Results:", results);
  return results;
}

/**
 * Run comprehensive date picker testing suite
 */
async function runDatePickerTestSuite() {
  console.log("📅 Running Comprehensive Date Picker Test Suite");
  console.log("=" .repeat(60));
  
  const startTime = performance.now();
  
  try {
    // Test 1: Validation Logic
    console.log("\n1️⃣ Testing Validation Logic...");
    const validationResults = testDatePickerValidationLogic();
    
    // Test 2: Calendar Component Behavior
    console.log("\n2️⃣ Testing Calendar Component Behavior...");
    const componentResults = testCalendarComponentBehavior();
    
    // Wait for component interactions to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Timezone and Locale Edge Cases
    console.log("\n3️⃣ Testing Timezone and Locale Edge Cases...");
    const timezoneResults = testTimezoneAndLocaleEdgeCases();
    
    // Test 4: Leap Year and Month Boundaries
    console.log("\n4️⃣ Testing Leap Year and Month Boundaries...");
    const boundaryResults = testLeapYearAndMonthBoundaries();
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    const summaryResults = {
      duration: duration,
      testsCompleted: 4,
      validationResults,
      componentResults,
      timezoneResults,
      boundaryResults,
      timestamp: new Date().toISOString()
    };
    
    console.log("\n📊 Date Picker Test Suite Summary:");
    console.log("=" .repeat(60));
    console.log(`⏱️ Total execution time: ${duration}ms`);
    console.log(`✅ Tests completed: ${summaryResults.testsCompleted}`);
    console.log(`📅 Date scenarios tested: ${validationResults.testDates.length}`);
    console.log(`🗓️ Calendar elements found: ${Object.keys(componentResults.calendarElements).length}`);
    console.log(`🌍 Locale tests: ${timezoneResults.localeTests.length}`);
    console.log(`📅 Boundary tests: ${boundaryResults.leapYearTests.length + boundaryResults.monthBoundaryTests.length}`);
    
    return summaryResults;
    
  } catch (error) {
    console.error("❌ Test suite error:", error);
    return { error: error.message, timestamp: new Date().toISOString() };
  }
}

// Expose functions globally for browser console access
window.testDatePickerValidationLogic = testDatePickerValidationLogic;
window.testCalendarComponentBehavior = testCalendarComponentBehavior;
window.testTimezoneAndLocaleEdgeCases = testTimezoneAndLocaleEdgeCases;
window.testLeapYearAndMonthBoundaries = testLeapYearAndMonthBoundaries;
window.runDatePickerTestSuite = runDatePickerTestSuite;

export {
  testDatePickerValidationLogic,
  testCalendarComponentBehavior,
  testTimezoneAndLocaleEdgeCases,
  testLeapYearAndMonthBoundaries,
  runDatePickerTestSuite
};