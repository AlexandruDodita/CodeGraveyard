/**
 * Test script to verify the UI setup
 * Run this with Node.js to check if the file structure is correct
 */

const fs = require('fs');
const path = require('path');

// Files to check
const filesToCheck = [
  'pages/index.html',
  'styles/main.css',
  'scripts/js/app.js',
  'review.json'
];

console.log('Amazon Product Analyzer UI Setup Test');
console.log('=====================================');

// Check if files exist
let allFilesExist = true;
filesToCheck.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  console.log(`${file}: ${exists ? '✅ Found' : '❌ Not found'}`);
  if (!exists) allFilesExist = false;
});

if (allFilesExist) {
  console.log('\n✅ All files are in place. The UI is ready to use.');
  console.log('\nTo test the UI:');
  console.log('1. Open pages/index.html in your browser');
  console.log('2. Enter an Amazon product URL and click "Analyze Product"');
  console.log('3. The UI will use the sample data from review.json');
} else {
  console.log('\n❌ Some files are missing. Please check the file structure.');
}

// Try to read review.json to make sure it's valid JSON
try {
  const reviewJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'review.json'), 'utf8'));
  console.log('\n✅ review.json is valid JSON and can be parsed correctly.');
} catch (error) {
  console.log('\n❌ Error reading or parsing review.json:', error.message);
} 