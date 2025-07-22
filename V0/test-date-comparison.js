// Test script to verify date comparison logic
console.log('🧪 Testing date comparison logic...');

// Simulate the isDateDisabled function with the fix
function isDateDisabled(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Normalize the input date to start of day for proper comparison
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  
  // Disable dates before today
  if (normalizedDate < today) {
    return true;
  }
  
  return false;
}

// Test cases
const testCases = [
  {
    name: 'Today',
    date: new Date(),
    expected: false
  },
  {
    name: 'Yesterday',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000),
    expected: true
  },
  {
    name: 'Tomorrow',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000),
    expected: false
  },
  {
    name: 'Next week',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    expected: false
  },
  {
    name: 'Today with different time',
    date: new Date(Date.now() + 12 * 60 * 60 * 1000), // Today at noon
    expected: false
  }
];

console.log('\n📅 Testing date comparison:');
testCases.forEach(test => {
  const result = isDateDisabled(test.date);
  const status = result === test.expected ? '✅' : '❌';
  console.log(`${status} ${test.name}: ${test.date.toDateString()} - Expected: ${test.expected}, Got: ${result}`);
});

console.log('\n🎯 Date comparison test completed!'); 