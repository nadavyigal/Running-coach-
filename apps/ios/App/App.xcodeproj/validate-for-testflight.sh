#!/bin/bash

# RunSmart Pre-TestFlight Validation Script
# Run this in VS Code terminal before uploading to TestFlight

echo "🚀 RunSmart Pre-TestFlight Validation"
echo "======================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0
PASSED=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} Found: $1"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} Missing: $1"
        ((ERRORS++))
        return 1
    fi
}

# Function to search for patterns in files
search_pattern() {
    local pattern=$1
    local file_pattern=$2
    local description=$3
    
    if grep -r "$pattern" $file_pattern 2>/dev/null | grep -v node_modules | grep -v ".git" | head -5; then
        echo -e "${YELLOW}⚠${NC} Warning: Found $description"
        ((WARNINGS++))
        return 1
    else
        echo -e "${GREEN}✓${NC} No $description found"
        ((PASSED++))
        return 0
    fi
}

echo "1️⃣  Checking Project Structure..."
echo "-----------------------------------"
check_file "package.json"
check_file "capacitor.config.json" || check_file "capacitor.config.ts"
check_file "ios/App/App.xcodeproj/project.pbxproj"
echo ""

echo "2️⃣  Checking Configuration Files..."
echo "-----------------------------------"

# Check Capacitor config
if [ -f "capacitor.config.json" ]; then
    echo "Checking capacitor.config.json..."
    
    if grep -q "localhost" capacitor.config.json; then
        echo -e "${RED}✗${NC} Found 'localhost' in capacitor.config.json - MUST BE REMOVED"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓${NC} No localhost found in capacitor.config.json"
        ((PASSED++))
    fi
    
    if grep -q '"url"' capacitor.config.json | grep -v '""'; then
        echo -e "${YELLOW}⚠${NC} Warning: server.url might be set in capacitor.config.json"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✓${NC} Server URL appears empty"
        ((PASSED++))
    fi
fi

# Check for environment files
if [ -f ".env" ]; then
    echo "Checking .env file..."
    if grep -q "localhost" .env; then
        echo -e "${YELLOW}⚠${NC} Warning: localhost found in .env - verify production settings"
        ((WARNINGS++))
    fi
    if grep -i -q "debug.*true" .env; then
        echo -e "${YELLOW}⚠${NC} Warning: Debug mode enabled in .env"
        ((WARNINGS++))
    fi
fi

if [ -f ".env.production" ]; then
    echo -e "${GREEN}✓${NC} Found .env.production file"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} No .env.production file found"
    ((WARNINGS++))
fi
echo ""

echo "3️⃣  Searching for Debug Code..."
echo "-----------------------------------"

# Search for console.log in source files
echo "Checking for console.log..."
if find src -type f -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" 2>/dev/null | xargs grep -l "console\.log" | head -5; then
    echo -e "${YELLOW}⚠${NC} Warning: Found console.log statements"
    ((WARNINGS++))
else
    echo -e "${GREEN}✓${NC} No console.log found"
    ((PASSED++))
fi

# Search for debugger statements
echo "Checking for debugger statements..."
if find src -type f -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" 2>/dev/null | xargs grep -l "debugger" | head -5; then
    echo -e "${RED}✗${NC} Found debugger statements - MUST BE REMOVED"
    ((ERRORS++))
else
    echo -e "${GREEN}✓${NC} No debugger statements found"
    ((PASSED++))
fi

# Search for alert() calls
echo "Checking for alert() calls..."
if find src -type f -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" 2>/dev/null | xargs grep -l "alert(" | head -5; then
    echo -e "${YELLOW}⚠${NC} Warning: Found alert() calls"
    ((WARNINGS++))
else
    echo -e "${GREEN}✓${NC} No alert() calls found"
    ((PASSED++))
fi
echo ""

echo "4️⃣  Checking Dependencies..."
echo "-----------------------------------"

if [ -f "package.json" ]; then
    echo "Checking for outdated packages..."
    echo -e "${YELLOW}ℹ${NC} Run 'npm outdated' to see full report"
    
    # Check if node_modules exists
    if [ -d "node_modules" ]; then
        echo -e "${GREEN}✓${NC} node_modules directory exists"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} node_modules missing - run 'npm install'"
        ((ERRORS++))
    fi
fi
echo ""

echo "5️⃣  Checking iOS Project..."
echo "-----------------------------------"

# Check for Info.plist
if [ -f "ios/App/App/Info.plist" ]; then
    echo -e "${GREEN}✓${NC} Found Info.plist"
    ((PASSED++))
    
    # Check for location permissions
    if grep -q "NSLocationWhenInUseUsageDescription" ios/App/App/Info.plist; then
        echo -e "${GREEN}✓${NC} NSLocationWhenInUseUsageDescription present"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} Missing NSLocationWhenInUseUsageDescription"
        ((ERRORS++))
    fi
    
    if grep -q "NSLocationAlwaysAndWhenInUseUsageDescription" ios/App/App/Info.plist; then
        echo -e "${GREEN}✓${NC} NSLocationAlwaysAndWhenInUseUsageDescription present"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} Missing NSLocationAlwaysAndWhenInUseUsageDescription"
        ((ERRORS++))
    fi
else
    echo -e "${YELLOW}⚠${NC} Info.plist not found at expected location"
    ((WARNINGS++))
fi

# Check for xcconfig files
if [ -f "ios/App/debug.xcconfig" ]; then
    echo -e "${GREEN}✓${NC} Found debug.xcconfig"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} debug.xcconfig not found"
    ((WARNINGS++))
fi

if [ -f "ios/App/release.xcconfig" ]; then
    echo -e "${GREEN}✓${NC} Found release.xcconfig"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} release.xcconfig not found - CREATE IT!"
    ((ERRORS++))
fi
echo ""

echo "6️⃣  Checking Build Output..."
echo "-----------------------------------"

# Check for build directory
if [ -d "dist" ] || [ -d "build" ] || [ -d "www" ]; then
    echo -e "${GREEN}✓${NC} Build output directory exists"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} No build output found - run 'npm run build'"
    ((WARNINGS++))
fi

# Check if iOS public folder has content
if [ -d "ios/App/public" ] && [ "$(ls -A ios/App/public)" ]; then
    echo -e "${GREEN}✓${NC} iOS app has synced web content"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} iOS app needs sync - run 'npx cap sync ios'"
    ((WARNINGS++))
fi
echo ""

echo "7️⃣  Security Checks..."
echo "-----------------------------------"

# Check for exposed secrets
echo "Checking for potential secrets..."
if find src -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) 2>/dev/null | xargs grep -i -E "(api[_-]?key|secret|password|token).*=.*['\"][a-zA-Z0-9]{10}" | grep -v "placeholder" | head -5; then
    echo -e "${RED}✗${NC} WARNING: Potential hardcoded secrets found!"
    ((ERRORS++))
else
    echo -e "${GREEN}✓${NC} No obvious hardcoded secrets"
    ((PASSED++))
fi

# Check for HTTP (non-HTTPS) URLs in config
echo "Checking for non-HTTPS URLs..."
if grep -r "http://" src/ --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" | grep -v "localhost" | grep -v "http://www.w3.org" | head -5; then
    echo -e "${YELLOW}⚠${NC} Warning: Non-HTTPS URLs found"
    ((WARNINGS++))
else
    echo -e "${GREEN}✓${NC} No non-HTTPS URLs found"
    ((PASSED++))
fi
echo ""

echo "======================================"
echo "📊 VALIDATION SUMMARY"
echo "======================================"
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${YELLOW}⚠ Warnings: $WARNINGS${NC}"
echo -e "${RED}✗ Errors: $ERRORS${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ CRITICAL ERRORS FOUND${NC}"
    echo "Fix all errors before uploading to TestFlight"
    echo ""
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  WARNINGS FOUND${NC}"
    echo "Review warnings before uploading to TestFlight"
    echo "Warnings may be acceptable depending on your app"
    echo ""
    exit 0
else
    echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
    echo "Your app is ready for TestFlight upload!"
    echo ""
    echo "Next steps:"
    echo "1. Run 'npm run build' to create production build"
    echo "2. Run 'npx cap sync ios' to sync with iOS"
    echo "3. Open Xcode: 'npx cap open ios'"
    echo "4. Archive and upload: Product → Archive"
    echo ""
    exit 0
fi
