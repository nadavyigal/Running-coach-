# Development Setup Guide

## Overview
This guide provides comprehensive instructions for setting up the Run-Smart application development environment, including troubleshooting common issues, cache management, and development best practices.

## Prerequisites

### System Requirements
- **Node.js**: Version 18.0 or higher
- **npm**: Version 9.0 or higher (comes with Node.js)
- **Git**: Latest version
- **VS Code**: Recommended IDE with extensions
- **Chrome/Edge**: For development and debugging

### Environment Setup
```bash
# Check Node.js version
node --version  # Should be 18.0+

# Check npm version  
npm --version   # Should be 9.0+

# Update npm if needed
npm install -g npm@latest
```

## Initial Setup

### 1. Clone Repository
```bash
# Clone the repository
git clone <repository-url>
cd Running-coach-

# Navigate to the main application directory
cd V0
```

### 2. Install Dependencies
```bash
# Install all dependencies
npm install

# Clear npm cache if installation fails
npm cache clean --force
npm install
```

### 3. Environment Configuration

Create `.env.local` file in the `V0/` directory:
```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Analytics (Optional)
NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id

# Database URL (Optional - uses IndexedDB by default)
DATABASE_URL=your_database_url

# Development Settings
NODE_ENV=development
NEXT_PUBLIC_APP_ENV=development
```

### 4. Verify Installation
```bash
# Run development server
npm run dev

# Server should start at http://localhost:3000
# Check browser console for any errors
```

## Development Commands

### Core Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint

# Fix linting issues
npm run lint -- --fix
```

### Testing Commands
```bash
# Run all tests
npm run test

# Run tests in watch mode (default)
npm run test

# Run tests once without watch
npm run test -- --run

# Run tests with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- ComponentName

# Run end-to-end tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug
```

## Cache Management

### Common Cache Issues
The application uses multiple caching layers that can cause development issues:

1. **Next.js Build Cache** (`.next/` directory)
2. **npm Cache** (package installations)
3. **Browser Cache** (development assets)
4. **Service Worker Cache** (PWA functionality)

### Cache Clearing Procedures

#### 1. Clear Next.js Build Cache
```bash
# Remove build directory
rm -rf .next

# On Windows
rmdir /s .next

# Restart development server
npm run dev
```

#### 2. Clear npm Cache
```bash
# Clear npm cache globally
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules
npm install

# On Windows
rmdir /s node_modules
npm install
```

#### 3. Clear Browser Cache
- **Chrome/Edge**: Ctrl+Shift+R (hard refresh)
- **Developer Tools**: Application tab > Storage > Clear storage
- **Incognito Mode**: Test without cached data

#### 4. Automated Cache Clearing
Use the provided PowerShell script (Windows):
```powershell
# Run the cache clearing script
.\clear-cache-and-restart.ps1
```

Or create your own script:
```bash
#!/bin/bash
# clear-cache.sh

echo "Clearing Next.js cache..."
rm -rf .next

echo "Clearing npm cache..."
npm cache clean --force

echo "Clearing node_modules..."
rm -rf node_modules
npm install

echo "Cache cleared! Restarting development server..."
npm run dev
```

### When to Clear Cache

Clear cache when experiencing:
- **ChunkLoadError**: Loading chunk failed errors
- **Module Resolution**: Import/export errors
- **Build Issues**: Compilation or build failures  
- **Stale Dependencies**: Outdated package issues
- **Development Server**: Server won't start or reload

## Troubleshooting Common Issues

### 1. ChunkLoadError: Loading Chunk Failed
**Symptoms**: Browser shows "Loading chunk app/layout failed" error

**Solutions**:
```bash
# 1. Clear Next.js cache
rm -rf .next

# 2. Clear browser cache (hard refresh)
# Ctrl+Shift+R in browser

# 3. Restart development server
npm run dev

# 4. If persistent, clear all caches
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

**Prevention**:
- The app includes `ChunkErrorBoundary` for automatic recovery
- Enhanced `next.config.mjs` with optimized webpack settings
- Regular cache clearing during development

### 2. Module Not Found Errors
**Symptoms**: Cannot resolve module or import errors

**Solutions**:
```bash
# 1. Check if module exists
npm list package-name

# 2. Reinstall specific package
npm uninstall package-name
npm install package-name

# 3. Clear npm cache and reinstall all
npm cache clean --force
rm -rf node_modules
npm install
```

### 3. Database Connection Issues
**Symptoms**: IndexedDB errors or data not persisting

**Solutions**:
```bash
# 1. Clear browser storage
# Browser Dev Tools > Application > Storage > Clear storage

# 2. Check database health in browser console
# Open Dev Tools and run:
# localStorage.clear()
# sessionStorage.clear()

# 3. Reset application data
# Settings > Privacy > Clear browsing data
```

### 4. API Endpoint Errors
**Symptoms**: 500 errors or API not responding

**Solutions**:
```bash
# 1. Check environment variables
echo $OPENAI_API_KEY

# 2. Test API endpoints
curl -X GET http://localhost:3000/api/health

# 3. Check server logs
npm run dev 2>&1 | grep -i error

# 4. Restart development server
npm run dev
```

### 5. Test Failures
**Symptoms**: Tests failing or not running

**Solutions**:
```bash
# 1. Clear test cache
npm run test -- --clearCache

# 2. Update test snapshots
npm run test -- --updateSnapshot

# 3. Run tests in isolation
npm run test -- --runInBand

# 4. Check test environment
npm run test -- --verbose
```

### 6. Build Failures
**Symptoms**: `npm run build` fails

**Solutions**:
```bash
# 1. Clear all caches
rm -rf .next node_modules package-lock.json
npm install

# 2. Check TypeScript errors
npx tsc --noEmit

# 3. Check ESLint errors
npm run lint

# 4. Build with verbose output
npm run build -- --debug
```

## Development Best Practices

### 1. Code Quality
```bash
# Run linting before committing
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix

# Check TypeScript compilation
npx tsc --noEmit

# Run tests before push
npm run test -- --run
```

### 2. Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Regular commits with descriptive messages
git add .
git commit -m "feat: add user authentication"

# Keep branch updated
git pull origin main
git rebase main

# Push changes
git push origin feature/your-feature-name
```

### 3. Database Development
```bash
# Check database health
# In browser console:
db.open().then(() => console.log('DB healthy'))

# Clear development data
# In browser Dev Tools:
# Application > Storage > IndexedDB > Delete

# Test database operations
npm run test -- db.test.tsx
```

### 4. API Development
```bash
# Test API endpoints during development
curl -X POST http://localhost:3000/api/onboarding/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}],"currentPhase":"motivation"}'

# Monitor API responses
# Check Network tab in Dev Tools

# Test error handling
# Remove OPENAI_API_KEY and test fallbacks
```

## IDE Configuration

### VS Code Extensions
Recommended extensions for development:

```json
{
  "recommendations": [
    "ms-typescript.typescript",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright",
    "vitest.explorer", 
    "ms-vscode.vscode-json",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint"
  ]
}
```

### VS Code Settings
Add to `.vscode/settings.json`:
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

### Launch Configuration
Add to `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Next.js",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/V0/node_modules/next/dist/bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}/V0",
      "runtimeArgs": ["--inspect"],
      "env": {
        "NODE_OPTIONS": "--inspect"
      }
    }
  ]
}
```

## Performance Optimization

### Development Performance
```bash
# Use Next.js turbo mode (experimental)
npm run dev -- --turbo

# Enable webpack caching
# Already configured in next.config.mjs

# Monitor bundle size
npm run build && npm run analyze

# Profile performance
# Chrome DevTools > Performance tab
```

### Memory Management
```bash
# Increase Node.js memory limit if needed
export NODE_OPTIONS="--max-old-space-size=4096"

# Monitor memory usage
node --inspect npm run dev
# Chrome DevTools > Memory tab
```

## Testing Setup

### Unit Testing
The project uses **Vitest** for unit testing:

```javascript
// Example test structure
import { render, screen } from '@testing-library/react'
import { expect, test, beforeEach } from 'vitest'
import ComponentName from '../ComponentName'

beforeEach(() => {
  // Reset database state
  // Clear local storage
})

test('should render component', () => {
  render(<ComponentName />)
  expect(screen.getByText('Expected Text')).toBeInTheDocument()
})
```

### E2E Testing
The project uses **Playwright** for end-to-end testing:

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run specific test file
npx playwright test onboarding.spec.ts

# Debug E2E tests
npm run test:e2e:debug
```

## Deployment Preparation

### Pre-deployment Checklist
```bash
# 1. Run all tests
npm run test -- --run
npm run test:e2e

# 2. Build successfully
npm run build

# 3. Check for TypeScript errors
npx tsc --noEmit

# 4. Lint code
npm run lint

# 5. Check bundle size
npm run build && npm run analyze

# 6. Test production build locally
npm run start
```

### Environment Variables
Ensure all required environment variables are set:
- `OPENAI_API_KEY` - Required for AI features
- `NEXT_PUBLIC_ANALYTICS_ID` - Optional analytics
- `DATABASE_URL` - Optional external database

## Monitoring and Debugging

### Development Monitoring
```bash
# Monitor file changes
npm run dev -- --verbose

# Monitor API requests
# Browser DevTools > Network tab

# Monitor database operations
# Browser DevTools > Application > IndexedDB

# Monitor performance
# Browser DevTools > Performance tab
```

### Error Logging
```javascript
// Enable debug logging
localStorage.setItem('debug', 'app:*')

// Check error boundaries
// Components automatically log to console

// Monitor chunk loading
// Check ChunkErrorBoundary component
```

### Health Checks
```bash
# Check application health
curl http://localhost:3000/api/health

# Check database connectivity
# Browser console: db.open()

# Check API endpoints
curl http://localhost:3000/api/onboarding/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"messages":[],"currentPhase":"test"}'
```

## Common Development Workflows

### Adding New Features
1. **Create feature branch**: `git checkout -b feature/new-feature`
2. **Add components**: Create in `components/` directory
3. **Add tests**: Create `.test.tsx` files
4. **Update types**: Add to TypeScript interfaces
5. **Test locally**: Run tests and manual testing
6. **Commit changes**: Use conventional commit format
7. **Create PR**: Merge to main branch

### Fixing Bugs  
1. **Reproduce issue**: Create minimal test case
2. **Write failing test**: Add test that reproduces bug
3. **Fix implementation**: Make test pass
4. **Verify fix**: Run all tests
5. **Manual testing**: Test in browser
6. **Update documentation**: If needed

### Database Changes
1. **Update interfaces**: Modify `lib/db.ts`
2. **Add migrations**: If schema changes
3. **Update utilities**: Modify `lib/dbUtils.ts`
4. **Test changes**: Run database tests
5. **Clear dev data**: Reset browser storage

## Support and Resources

### Documentation
- **API Reference**: `/docs/api/`
- **Troubleshooting**: `/docs/troubleshooting/`
- **User Guide**: `/docs/user-guide/`
- **Architecture**: `/docs/fullstack-architecture.md`

### External Resources
- **Next.js Documentation**: https://nextjs.org/docs
- **React Documentation**: https://react.dev
- **Vitest Documentation**: https://vitest.dev
- **Playwright Documentation**: https://playwright.dev

### Getting Help
1. **Check troubleshooting guide**: Common issues and solutions
2. **Search documentation**: Comprehensive API and setup docs
3. **Check git history**: Recent changes and fixes
4. **Create issue**: Report bugs or request features

---

*Last Updated: 2025-07-23*
*Version: 1.0*
*Maintained by: Development Team*

## Recent Updates
- Added comprehensive cache management procedures
- Enhanced troubleshooting for ChunkLoadError issues
- Updated development commands and workflows
- Added IDE configuration recommendations
- Included testing setup and best practices