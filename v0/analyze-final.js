const data = require('./lighthouse-final-optimized.report.json');

console.log('=== FINAL OPTIMIZED BUILD ANALYSIS ===\n');

// Scores
const scores = data.categories;
console.log('Scores:');
console.log('  Performance:', Math.round(scores.performance.score * 100) + '/100');
console.log('  Accessibility:', Math.round(scores.accessibility.score * 100) + '/100');
console.log('  Best Practices:', Math.round(scores['best-practices'].score * 100) + '/100');
console.log('  SEO:', Math.round(scores.seo.score * 100) + '/100');

console.log('\n=== LARGEST NETWORK RESOURCES ===\n');
const networkRequests = data.audits['network-requests'];
if (networkRequests && networkRequests.details && networkRequests.details.items) {
  const sorted = networkRequests.details.items
    .filter(item => item.resourceSize > 10000)
    .sort((a, b) => b.resourceSize - a.resourceSize)
    .slice(0, 8);

  sorted.forEach((item, i) => {
    const url = item.url.length > 70 ? '...' + item.url.substring(item.url.length - 67) : item.url;
    console.log((i+1) + '. ' + Math.round(item.resourceSize / 1024) + 'KB - ' + url);
  });
}

console.log('\n=== KEY METRICS COMPARISON ===\n');
console.log('Metric           | Initial | Final | Change');
console.log('-----------------|---------|-------|-------');
console.log('Performance      |   60    |  63   | +3');
console.log('TBT              | 3,190ms | 2,190ms | -1,000ms');
console.log('LCP              |  3.4s   |  3.4s  | 0');
console.log('TTI              |  12.2s  | 12.6s | +0.4s');

console.log('\n=== REMAINING BOTTLENECKS ===\n');

const bootup = data.audits['bootup-time'];
if (bootup && bootup.details && bootup.details.items && bootup.details.items.length > 0) {
  console.log('JavaScript Execution Time:');
  bootup.details.items.slice(0, 5).forEach((item, i) => {
    const url = item.url.length > 60 ? '...' + item.url.substring(item.url.length - 57) : item.url;
    console.log('  ' + (i+1) + '. ' + Math.round(item.total) + 'ms - ' + url);
  });
}

const mainThread = data.audits['mainthread-work-breakdown'];
if (mainThread && mainThread.details && mainThread.details.items) {
  console.log('\nMain Thread Work:');
  mainThread.details.items.slice(0, 5).forEach(item => {
    console.log('  ' + item.group + ': ' + Math.round(item.duration) + 'ms');
  });
}

const unused = data.audits['unused-javascript'];
if (unused && unused.details && unused.details.overallSavingsMs) {
  console.log('\nUnused JavaScript:');
  console.log('  Potential savings: ' + Math.round(unused.details.overallSavingsMs) + 'ms');
}

const serverResponse = data.audits['server-response-time'];
if (serverResponse && serverResponse.numericValue) {
  console.log('\nServer Response Time:');
  console.log('  ' + Math.round(serverResponse.numericValue) + 'ms');
}
