const fs = require('fs');

// Check which report file exists
let reportFile = './lighthouse-final.report.json';
if (!fs.existsSync(reportFile)) {
  reportFile = './lighthouse-optimized.report.json';
}

const data = require(reportFile);

console.log('=== PERFORMANCE ANALYSIS ===\n');
console.log('Report:', reportFile, '\n');

// Scores
const scores = data.categories;
console.log('Scores:');
console.log('  Performance:', Math.round(scores.performance.score * 100) + '/100');
console.log('  Accessibility:', Math.round(scores.accessibility.score * 100) + '/100');
console.log('  Best Practices:', Math.round(scores['best-practices'].score * 100) + '/100');
console.log('  SEO:', Math.round(scores.seo.score * 100) + '/100');

// Opportunities for improvement
console.log('\n=== TOP OPPORTUNITIES ===\n');
const opportunities = data.audits;
const opps = [
  { key: 'unused-javascript', title: 'Remove unused JavaScript' },
  { key: 'render-blocking-resources', title: 'Eliminate render-blocking resources' },
  { key: 'unminified-javascript', title: 'Minify JavaScript' },
  { key: 'server-response-time', title: 'Reduce server response time' },
  { key: 'uses-text-compression', title: 'Enable text compression' },
];

opps.forEach(opp => {
  const audit = opportunities[opp.key];
  if (audit && audit.score !== null && audit.score < 1) {
    console.log('- ' + opp.title);
    if (audit.details && audit.details.overallSavingsMs) {
      console.log('  Savings: ' + Math.round(audit.details.overallSavingsMs) + 'ms');
    }
  }
});

console.log('\n=== MAIN THREAD WORK ===\n');
const mainThread = opportunities['mainthread-work-breakdown'];
if (mainThread && mainThread.details && mainThread.details.items) {
  mainThread.details.items.slice(0, 5).forEach(item => {
    console.log(item.group + ': ' + Math.round(item.duration) + 'ms');
  });
}

console.log('\n=== BOOTUP TIME (Top Scripts) ===\n');
const bootup = opportunities['bootup-time'];
if (bootup && bootup.details && bootup.details.items) {
  bootup.details.items.slice(0, 5).forEach((item, i) => {
    const url = item.url.length > 70 ? '...' + item.url.substring(item.url.length - 67) : item.url;
    console.log((i+1) + '. ' + url);
    console.log('   Total: ' + Math.round(item.total) + 'ms | Scripting: ' + Math.round(item.scripting) + 'ms');
  });
}

console.log('\n=== UNUSED JAVASCRIPT ===\n');
const unused = opportunities['unused-javascript'];
if (unused && unused.details) {
  if (unused.details.overallSavingsMs) {
    console.log('Total potential savings: ' + Math.round(unused.details.overallSavingsMs) + 'ms');
  }
  if (unused.details.items && unused.details.items.length > 0) {
    console.log('\nTop offenders:');
    unused.details.items.slice(0, 5).forEach((item, i) => {
      const url = item.url.length > 70 ? '...' + item.url.substring(item.url.length - 67) : item.url;
      console.log((i+1) + '. ' + url);
      console.log('   Wasted: ' + Math.round(item.wastedBytes / 1024) + 'KB (' + Math.round(item.wastedPercent) + '%)');
    });
  }
}

console.log('\n=== NETWORK REQUESTS (Largest) ===\n');
const networkRequests = opportunities['network-requests'];
if (networkRequests && networkRequests.details && networkRequests.details.items) {
  const sorted = networkRequests.details.items
    .filter(item => item.resourceSize > 10000)
    .sort((a, b) => b.resourceSize - a.resourceSize)
    .slice(0, 5);

  sorted.forEach((item, i) => {
    const url = item.url.length > 70 ? '...' + item.url.substring(item.url.length - 67) : item.url;
    console.log((i+1) + '. ' + url);
    console.log('   Size: ' + Math.round(item.resourceSize / 1024) + 'KB');
  });
}
