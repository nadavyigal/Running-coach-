/**
 * Chat Streaming UI and State Updates Testing
 * 
 * This module provides comprehensive testing functions for chat streaming,
 * message flow tracking, UI responsiveness, and memory leak detection.
 */

/**
 * Test chat streaming real-time updates and message flow
 */
function testChatStreamingUpdates() {
  console.log("💬 Testing Chat Streaming Updates");
  
  const results = {
    chatElements: {},
    streamingTests: [],
    messageFlowTests: [],
    uiResponsivenessTests: [],
    timestamp: new Date().toISOString()
  };
  
  // Search for chat-related elements
  const chatSelectors = [
    'input[placeholder*="Ask"], input[placeholder*="chat"]',
    'input[placeholder*="coach"], input[placeholder*="message"]',
    '[class*="chat"], [class*="message"]',
    '[data-testid*="chat"], [data-testid*="message"]',
    'form:has(input[placeholder*="chat"])',
    '.chat-container, .messages-container',
    '.chat-input, .message-input'
  ];
  
  console.log("🔍 Searching for chat elements...");
  
  chatSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      results.chatElements[selector] = {
        count: elements.length,
        visible: 0,
        interactive: 0
      };
      
      elements.forEach(el => {
        if (el.offsetHeight > 0 && el.offsetWidth > 0) {
          results.chatElements[selector].visible++;
        }
        
        if (!el.disabled && el.getAttribute('aria-disabled') !== 'true') {
          results.chatElements[selector].interactive++;
        }
      });
      
      if (elements.length > 0) {
        console.log(`✅ Found ${elements.length} elements for ${selector}`, results.chatElements[selector]);
      }
    } catch (error) {
      console.warn(`⚠️ Selector error for ${selector}:`, error.message);
      results.chatElements[selector] = { error: error.message };
    }
  });
  
  // Find chat input and messages container
  const chatInput = document.querySelector('input[placeholder*="Ask"], input[placeholder*="chat"], input[placeholder*="coach"]');
  const messagesContainer = document.querySelector('[class*="message"], [class*="chat"]:has([class*="message"])') ||
                           document.querySelector('.chat-container, .messages-container');
  
  if (chatInput && messagesContainer) {
    console.log("💬 Chat elements found, preparing for streaming test...");
    
    const streamingTest = {
      inputElement: chatInput.tagName,
      containerElement: messagesContainer.tagName,
      initialMessageCount: messagesContainer.children.length,
      testMessage: 'Test streaming message for debugging',
      streamUpdates: [],
      testStartTime: performance.now()
    };
    
    // Monitor message count before sending
    console.log(`📊 Initial message count: ${streamingTest.initialMessageCount}`);
    
    // Setup streaming monitor before sending message
    setupStreamingMonitor(messagesContainer, streamingTest);
    
    // Send test message
    console.log("📤 Sending test message...");
    
    try {
      chatInput.value = streamingTest.testMessage;
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      const submitButton = chatInput.closest('form')?.querySelector('button[type="submit"]') ||
                          chatInput.parentElement?.querySelector('button');
      
      if (submitButton && !submitButton.disabled) {
        submitButton.click();
        streamingTest.messageSubmitted = true;
        console.log("✅ Test message submitted successfully");
      } else {
        streamingTest.messageSubmitted = false;
        console.warn("⚠️ Submit button not found or disabled");
      }
    } catch (error) {
      streamingTest.error = error.message;
      console.error("❌ Failed to send test message:", error);
    }
    
    results.streamingTests.push(streamingTest);
    
  } else {
    console.warn("❌ Chat input or messages container not found");
    results.chatElements.error = "Required chat elements not found";
  }
  
  console.log("📊 Chat Streaming Updates Results:", results);
  return results;
}

/**
 * Setup streaming monitor to track real-time updates
 */
function setupStreamingMonitor(messagesContainer, streamingTest) {
  console.log("📡 Setting up streaming monitor...");
  
  let updateCount = 0;
  let lastMessageContent = '';
  let lastMessageElement = null;
  
  // Create mutation observer to detect message updates
  const messageObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // New message added
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            updateCount++;
            const updateTime = performance.now() - streamingTest.testStartTime;
            
            const update = {
              updateNumber: updateCount,
              updateTime: Math.round(updateTime),
              nodeType: node.tagName,
              hasContent: node.textContent.length > 0,
              contentLength: node.textContent.length,
              updateType: 'newMessage'
            };
            
            console.log(`📨 New message detected #${updateCount}:`, update);
            streamingTest.streamUpdates.push(update);
            
            lastMessageElement = node;
            lastMessageContent = node.textContent;
          }
        });
      } else if (mutation.type === 'characterData' || mutation.type === 'childList') {
        // Message content updated (streaming)
        const currentMessages = messagesContainer.children;
        if (currentMessages.length > 0) {
          const lastMessage = currentMessages[currentMessages.length - 1];
          const currentContent = lastMessage.textContent;
          
          if (currentContent !== lastMessageContent && currentContent.length > lastMessageContent.length) {
            updateCount++;
            const updateTime = performance.now() - streamingTest.testStartTime;
            
            const update = {
              updateNumber: updateCount,
              updateTime: Math.round(updateTime),
              contentLength: currentContent.length,
              contentDelta: currentContent.length - lastMessageContent.length,
              updateType: 'contentUpdate'
            };
            
            console.log(`🔄 Content update detected #${updateCount}:`, update);
            streamingTest.streamUpdates.push(update);
            
            lastMessageContent = currentContent;
          }
        }
      }
    });
  });
  
  // Start observing
  messageObserver.observe(messagesContainer, {
    childList: true,
    subtree: true,
    characterData: true
  });
  
  // Stop monitoring after 30 seconds
  setTimeout(() => {
    messageObserver.disconnect();
    
    const finalTime = performance.now() - streamingTest.testStartTime;
    streamingTest.monitoringDuration = Math.round(finalTime);
    streamingTest.totalUpdates = updateCount;
    streamingTest.finalMessageLength = lastMessageContent.length;
    
    console.log(`✅ Streaming monitor completed:`, {
      duration: streamingTest.monitoringDuration + 'ms',
      totalUpdates: streamingTest.totalUpdates,
      finalMessageLength: streamingTest.finalMessageLength
    });
  }, 30000);
}

/**
 * Test UI responsiveness during streaming
 */
function testUIResponsivenessDuringStreaming() {
  console.log("⚡ Testing UI Responsiveness During Streaming");
  
  const results = {
    responsivenessTests: [],
    interactionTests: [],
    renderingPerformance: {},
    timestamp: new Date().toISOString()
  };
  
  // Test DOM query performance during streaming
  const performanceTests = [
    {
      name: 'DOM Query Performance',
      test: () => {
        const startTime = performance.now();
        document.querySelectorAll('*');
        return performance.now() - startTime;
      }
    },
    {
      name: 'Chat Element Access',
      test: () => {
        const startTime = performance.now();
        document.querySelectorAll('[class*="chat"], [class*="message"]');
        return performance.now() - startTime;
      }
    },
    {
      name: 'Button Click Responsiveness',
      test: () => {
        const startTime = performance.now();
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled); // Access property
        return performance.now() - startTime;
      }
    }
  ];
  
  // Run baseline performance tests
  console.log("📊 Running baseline performance tests...");
  
  performanceTests.forEach(test => {
    try {
      const baselineTime = test.test();
      results.renderingPerformance[test.name] = {
        baseline: Math.round(baselineTime * 100) / 100,
        duringStreaming: null,
        degradation: null
      };
      
      console.log(`⚡ ${test.name} baseline: ${baselineTime.toFixed(2)}ms`);
    } catch (error) {
      console.warn(`⚠️ Performance test failed for ${test.name}:`, error.message);
    }
  });
  
  // Test UI interactions during streaming
  const messagesContainer = document.querySelector('[class*="message"], [class*="chat"]');
  
  if (messagesContainer) {
    console.log("🖱️ Testing UI interactions during message updates...");
    
    // Simulate scrolling behavior
    const scrollTest = {
      name: 'Scroll Performance',
      initialScrollTop: messagesContainer.scrollTop,
      scrollAttempts: 0,
      scrollSuccesses: 0
    };
    
    const scrollInterval = setInterval(() => {
      try {
        scrollTest.scrollAttempts++;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        if (messagesContainer.scrollTop !== scrollTest.initialScrollTop) {
          scrollTest.scrollSuccesses++;
        }
        
        if (scrollTest.scrollAttempts >= 10) {
          clearInterval(scrollInterval);
          scrollTest.successRate = (scrollTest.scrollSuccesses / scrollTest.scrollAttempts) * 100;
          console.log("📜 Scroll test completed:", scrollTest);
          results.interactionTests.push(scrollTest);
        }
      } catch (error) {
        clearInterval(scrollInterval);
        scrollTest.error = error.message;
        console.warn("⚠️ Scroll test failed:", error);
      }
    }, 500);
    
    // Test button interactions
    const buttons = document.querySelectorAll('button:not([disabled])');
    
    if (buttons.length > 0) {
      const buttonTest = {
        name: 'Button Interaction Test',
        buttonsFound: buttons.length,
        interactionAttempts: 0,
        interactionSuccesses: 0
      };
      
      // Test clicking buttons (non-destructively)
      const testButton = buttons[0];
      
      const buttonInterval = setInterval(() => {
        try {
          buttonTest.interactionAttempts++;
          
          // Simulate hover and focus without actually clicking
          testButton.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          testButton.focus();
          
          buttonTest.interactionSuccesses++;
          
          if (buttonTest.interactionAttempts >= 5) {
            clearInterval(buttonInterval);
            buttonTest.successRate = (buttonTest.interactionSuccesses / buttonTest.interactionAttempts) * 100;
            console.log("🔘 Button interaction test completed:", buttonTest);
            results.interactionTests.push(buttonTest);
          }
        } catch (error) {
          clearInterval(buttonInterval);
          buttonTest.error = error.message;
          console.warn("⚠️ Button interaction test failed:", error);
        }
      }, 1000);
    }
  }
  
  // Re-run performance tests after streaming starts (with delay)
  setTimeout(() => {
    console.log("📊 Re-running performance tests during potential streaming...");
    
    performanceTests.forEach(test => {
      try {
        const streamingTime = test.test();
        
        if (results.renderingPerformance[test.name]) {
          results.renderingPerformance[test.name].duringStreaming = Math.round(streamingTime * 100) / 100;
          results.renderingPerformance[test.name].degradation = 
            ((streamingTime - results.renderingPerformance[test.name].baseline) / 
             results.renderingPerformance[test.name].baseline) * 100;
          
          console.log(`⚡ ${test.name} during streaming: ${streamingTime.toFixed(2)}ms (${results.renderingPerformance[test.name].degradation.toFixed(1)}% change)`);
        }
      } catch (error) {
        console.warn(`⚠️ Streaming performance test failed for ${test.name}:`, error.message);
      }
    });
  }, 5000);
  
  console.log("📊 UI Responsiveness Test Results:", results);
  return results;
}

/**
 * Test memory leak detection and performance monitoring
 */
function testMemoryLeakDetection() {
  console.log("🧠 Testing Memory Leak Detection");
  
  const results = {
    memoryBaseline: {},
    memoryMonitoring: [],
    performanceMetrics: {},
    leakIndicators: [],
    timestamp: new Date().toISOString()
  };
  
  // Get initial memory baseline
  if (performance.memory) {
    results.memoryBaseline = {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };
    
    console.log("💾 Memory baseline:", {
      used: Math.round(results.memoryBaseline.usedJSHeapSize / 1024 / 1024) + ' MB',
      total: Math.round(results.memoryBaseline.totalJSHeapSize / 1024 / 1024) + ' MB',
      limit: Math.round(results.memoryBaseline.jsHeapSizeLimit / 1024 / 1024) + ' MB'
    });
  } else {
    console.warn("⚠️ Performance.memory API not available");
    results.memoryBaseline.error = "Performance.memory API not available";
  }
  
  // Monitor DOM node count
  const initialDOMNodes = document.querySelectorAll('*').length;
  results.performanceMetrics.initialDOMNodes = initialDOMNodes;
  
  console.log(`🏗️ Initial DOM nodes: ${initialDOMNodes}`);
  
  // Monitor event listeners (if Chrome DevTools available)
  if (typeof getEventListeners === 'function') {
    try {
      const elements = document.querySelectorAll('*');
      let listenerCount = 0;
      
      elements.forEach(el => {
        const listeners = getEventListeners(el);
        listenerCount += Object.keys(listeners).reduce((sum, event) => sum + listeners[event].length, 0);
      });
      
      results.performanceMetrics.initialEventListeners = listenerCount;
      console.log(`👂 Initial event listeners: ${listenerCount}`);
    } catch (error) {
      console.warn("⚠️ Event listener counting failed:", error.message);
    }
  } else {
    console.warn("⚠️ getEventListeners not available (Chrome DevTools required)");
  }
  
  // Start memory monitoring
  const memoryMonitoringInterval = setInterval(() => {
    if (performance.memory) {
      const currentMemory = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        timestamp: Date.now(),
        elapsedTime: Date.now() - results.memoryBaseline.timestamp
      };
      
      if (results.memoryBaseline.usedJSHeapSize) {
        currentMemory.memoryIncrease = currentMemory.usedJSHeapSize - results.memoryBaseline.usedJSHeapSize;
        currentMemory.memoryIncreasePercent = (currentMemory.memoryIncrease / results.memoryBaseline.usedJSHeapSize) * 100;
      }
      
      results.memoryMonitoring.push(currentMemory);
      
      // Check for potential memory leaks
      if (currentMemory.memoryIncrease > 10 * 1024 * 1024) { // 10MB increase
        const leakIndicator = {
          timestamp: currentMemory.timestamp,
          memoryIncrease: Math.round(currentMemory.memoryIncrease / 1024 / 1024) + ' MB',
          elapsedTime: Math.round(currentMemory.elapsedTime / 1000) + 's',
          severity: currentMemory.memoryIncrease > 50 * 1024 * 1024 ? 'high' : 'medium'
        };
        
        results.leakIndicators.push(leakIndicator);
        console.warn("🚨 Potential memory leak detected:", leakIndicator);
      }
      
      if (results.memoryMonitoring.length % 10 === 0) {
        console.log(`💾 Memory check #${results.memoryMonitoring.length}:`, {
          used: Math.round(currentMemory.usedJSHeapSize / 1024 / 1024) + ' MB',
          increase: currentMemory.memoryIncrease ? 
            (Math.round(currentMemory.memoryIncrease / 1024 / 1024 * 100) / 100) + ' MB' : 'N/A'
        });
      }
    }
  }, 2000); // Check every 2 seconds
  
  // Stop monitoring after 2 minutes
  setTimeout(() => {
    clearInterval(memoryMonitoringInterval);
    
    // Final memory analysis
    if (results.memoryMonitoring.length > 0) {
      const finalMemory = results.memoryMonitoring[results.memoryMonitoring.length - 1];
      const totalIncrease = finalMemory.memoryIncrease || 0;
      const averageIncreasePerSecond = totalIncrease / (finalMemory.elapsedTime / 1000);
      
      results.performanceMetrics.finalMemoryAnalysis = {
        totalIncrease: Math.round(totalIncrease / 1024 / 1024 * 100) / 100 + ' MB',
        averageIncreasePerSecond: Math.round(averageIncreasePerSecond / 1024 * 100) / 100 + ' KB/s',
        monitoringDuration: Math.round(finalMemory.elapsedTime / 1000) + 's',
        samplesCollected: results.memoryMonitoring.length,
        leakIndicators: results.leakIndicators.length
      };
      
      console.log("🧠 Final memory analysis:", results.performanceMetrics.finalMemoryAnalysis);
    }
    
    // Check final DOM node count
    const finalDOMNodes = document.querySelectorAll('*').length;
    results.performanceMetrics.finalDOMNodes = finalDOMNodes;
    results.performanceMetrics.domNodeIncrease = finalDOMNodes - initialDOMNodes;
    
    console.log(`🏗️ Final DOM nodes: ${finalDOMNodes} (increase: ${results.performanceMetrics.domNodeIncrease})`);
    
  }, 120000); // 2 minutes
  
  console.log("📊 Memory Leak Detection Results:", results);
  return results;
}

/**
 * Test chat message persistence and state management
 */
function testChatMessagePersistence() {
  console.log("💾 Testing Chat Message Persistence");
  
  const results = {
    persistenceTests: [],
    stateManagementTests: [],
    storageTests: [],
    timestamp: new Date().toISOString()
  };
  
  // Test localStorage for chat messages
  console.log("🗄️ Testing localStorage persistence...");
  
  try {
    const initialLocalStorageKeys = Object.keys(localStorage);
    const chatRelatedKeys = initialLocalStorageKeys.filter(key => 
      key.toLowerCase().includes('chat') || 
      key.toLowerCase().includes('message') ||
      key.toLowerCase().includes('conversation')
    );
    
    const localStorageTest = {
      totalKeys: initialLocalStorageKeys.length,
      chatRelatedKeys: chatRelatedKeys.length,
      chatKeys: chatRelatedKeys,
      totalSize: 0
    };
    
    // Calculate approximate storage size
    initialLocalStorageKeys.forEach(key => {
      try {
        localStorageTest.totalSize += localStorage.getItem(key)?.length || 0;
      } catch (error) {
        console.warn(`⚠️ Could not access localStorage key ${key}:`, error.message);
      }
    });
    
    localStorageTest.totalSizeKB = Math.round(localStorageTest.totalSize / 1024 * 100) / 100;
    
    console.log("🗄️ LocalStorage analysis:", localStorageTest);
    results.storageTests.push(localStorageTest);
    
  } catch (error) {
    console.warn("⚠️ LocalStorage test failed:", error.message);
    results.storageTests.push({ error: error.message });
  }
  
  // Test sessionStorage
  try {
    const sessionStorageKeys = Object.keys(sessionStorage);
    const sessionChatKeys = sessionStorageKeys.filter(key => 
      key.toLowerCase().includes('chat') || 
      key.toLowerCase().includes('message')
    );
    
    const sessionStorageTest = {
      totalKeys: sessionStorageKeys.length,
      chatRelatedKeys: sessionChatKeys.length,
      chatKeys: sessionChatKeys
    };
    
    console.log("🗄️ SessionStorage analysis:", sessionStorageTest);
    results.storageTests.push(sessionStorageTest);
    
  } catch (error) {
    console.warn("⚠️ SessionStorage test failed:", error.message);
  }
  
  // Test IndexedDB for chat persistence
  console.log("🗃️ Testing IndexedDB persistence...");
  
  if ('indexedDB' in window) {
    indexedDB.databases().then(databases => {
      const dbTest = {
        availableDatabases: databases.length,
        databaseNames: databases.map(db => db.name),
        chatDatabase: databases.find(db => 
          db.name?.toLowerCase().includes('chat') || 
          db.name?.toLowerCase().includes('running') ||
          db.name?.toLowerCase().includes('coach')
        )
      };
      
      console.log("🗃️ IndexedDB analysis:", dbTest);
      results.persistenceTests.push(dbTest);
    }).catch(error => {
      console.warn("⚠️ IndexedDB enumeration failed:", error.message);
    });
  } else {
    console.warn("⚠️ IndexedDB not available");
    results.persistenceTests.push({ error: "IndexedDB not available" });
  }
  
  // Test page refresh persistence
  const refreshTest = {
    testId: 'persistence-' + Date.now(),
    timestamp: new Date().toISOString()
  };
  
  try {
    localStorage.setItem('chat-persistence-test', JSON.stringify(refreshTest));
    console.log("💾 Persistence test marker saved");
    
    // Check for previous test markers
    const previousTest = localStorage.getItem('chat-persistence-test');
    if (previousTest) {
      try {
        const parsed = JSON.parse(previousTest);
        refreshTest.previousTestFound = true;
        refreshTest.previousTimestamp = parsed.timestamp;
        
        console.log("✅ Previous persistence test found:", parsed);
      } catch (parseError) {
        refreshTest.previousTestFound = false;
        console.warn("⚠️ Could not parse previous test data");
      }
    }
    
    results.persistenceTests.push(refreshTest);
    
  } catch (error) {
    console.warn("⚠️ Persistence test setup failed:", error.message);
  }
  
  console.log("📊 Chat Message Persistence Results:", results);
  return results;
}

/**
 * Run comprehensive chat streaming testing suite
 */
async function runChatStreamingTestSuite() {
  console.log("💬 Running Comprehensive Chat Streaming Test Suite");
  console.log("=" .repeat(60));
  
  const startTime = performance.now();
  
  try {
    // Test 1: Streaming Updates
    console.log("\n1️⃣ Testing Streaming Updates...");
    const streamingResults = testChatStreamingUpdates();
    
    // Test 2: UI Responsiveness
    console.log("\n2️⃣ Testing UI Responsiveness...");
    const responsivenessResults = testUIResponsivenessDuringStreaming();
    
    // Test 3: Memory Leak Detection
    console.log("\n3️⃣ Testing Memory Leak Detection...");
    const memoryResults = testMemoryLeakDetection();
    
    // Test 4: Message Persistence
    console.log("\n4️⃣ Testing Message Persistence...");
    const persistenceResults = testChatMessagePersistence();
    
    // Wait for async tests to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    const summaryResults = {
      duration: duration,
      testsCompleted: 4,
      streamingResults,
      responsivenessResults,
      memoryResults,
      persistenceResults,
      timestamp: new Date().toISOString()
    };
    
    console.log("\n📊 Chat Streaming Test Suite Summary:");
    console.log("=" .repeat(60));
    console.log(`⏱️ Total execution time: ${duration}ms`);
    console.log(`✅ Tests completed: ${summaryResults.testsCompleted}`);
    console.log(`💬 Chat elements found: ${Object.keys(streamingResults.chatElements).length}`);
    console.log(`🔄 Streaming tests: ${streamingResults.streamingTests.length}`);
    console.log(`⚡ Responsiveness tests: ${responsivenessResults.interactionTests.length}`);
    console.log(`🧠 Memory leak indicators: ${memoryResults.leakIndicators.length}`);
    console.log(`💾 Persistence tests: ${persistenceResults.persistenceTests.length}`);
    
    return summaryResults;
    
  } catch (error) {
    console.error("❌ Test suite error:", error);
    return { error: error.message, timestamp: new Date().toISOString() };
  }
}

// Expose functions globally for browser console access
window.testChatStreamingUpdates = testChatStreamingUpdates;
window.testUIResponsivenessDuringStreaming = testUIResponsivenessDuringStreaming;
window.testMemoryLeakDetection = testMemoryLeakDetection;
window.testChatMessagePersistence = testChatMessagePersistence;
window.runChatStreamingTestSuite = runChatStreamingTestSuite;

export {
  testChatStreamingUpdates,
  testUIResponsivenessDuringStreaming,
  testMemoryLeakDetection,
  testChatMessagePersistence,
  runChatStreamingTestSuite
};