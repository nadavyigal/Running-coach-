# RunSmart AI - Intelligent Running Coach

A Progressive Web App (PWA) providing personalized AI-powered running coaching with local-first architecture and cloud sync capabilities.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Enabled-green)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🌟 Features

### Core Features
- **📱 PWA Support** - Install as native app on any device
- **🏃 Run Tracking** - GPS tracking, pace, distance, heart rate monitoring
- **📊 Training Plans** - AI-generated personalized training plans
- **🎯 Goal Management** - Set and track distance, speed, race, and habit goals
- **💬 AI Coach Chat** - Real-time coaching advice powered by GPT-4
- **👟 Shoe Tracking** - Monitor mileage and retire shoes at the right time
- **📈 Performance Analytics** - Detailed insights and personal records
- **🏆 Badges & Achievements** - Gamified progress tracking

### Advanced Features
- **💓 Heart Rate Zones** - Training zone analysis and optimization
- **😴 Recovery Tracking** - Sleep, HRV, and wellness monitoring
- **🗺️ Route Maps** - Visual GPS path tracking with elevation
- **📸 Run from Photo** - AI extraction of run data from images/screenshots
- **👥 Social Cohorts** - Group training and community features

### Latest Features (Phases 1-4)
- **🔐 Authentication** - Secure email/password auth with Supabase
- **☁️ Cloud Sync** - Automatic background sync (every 5 minutes)
- **📲 Device Migration** - Seamless data transfer between devices
- **🔄 Sync Status** - Real-time sync indicator with error handling
- **👨‍💼 Admin Dashboard** - Analytics, user management, metrics tracking
- **📊 Analytics Integration** - PostHog and Google Analytics

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/running-coach-app.git
cd running-coach-app/v0

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Configure environment variables (see Configuration section)

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## ⚙️ Configuration

### Required Environment Variables

```env
# Supabase (Required for auth & sync)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (Required for AI features)
OPENAI_API_KEY=sk-proj-your-key
```

### Optional Environment Variables

```env
# Analytics
NEXT_PUBLIC_POSTHOG_API_KEY=phc_your-key
NEXT_PUBLIC_GA_ID=G-YOUR-ID

# Admin Dashboard
ADMIN_EMAILS=admin@example.com,another-admin@example.com

# Maps (for route visualization)
NEXT_PUBLIC_MAP_TILE_TOKEN=your-maptiler-token
```

See [`.env.example`](.env.example) for complete list.

## 📖 Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- **[Architecture Guide](docs/ARCHITECTURE.md)** - System design and technical architecture
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[API Reference](docs/API-REFERENCE.md)** - Complete API documentation
- **[Admin Dashboard Guide](docs/ADMIN-DASHBOARD-GUIDE.md)** - Admin features and usage
- **[Testing Guide](docs/MANUAL-TESTING-CHECKLIST.md)** - Comprehensive testing checklist
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🏗️ Architecture

RunSmart AI uses a **local-first architecture** for instant performance:

```
User Action → IndexedDB (instant) → UI Update
                    ↓
            Background Sync
                    ↓
            Supabase Cloud
```

### Key Technologies

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Local Storage**: Dexie.js (IndexedDB) - 80+ tables
- **Cloud Database**: Supabase PostgreSQL - 9 synced tables
- **Authentication**: Supabase Auth with JWT tokens
- **AI**: OpenAI GPT-4o via Vercel AI SDK
- **Analytics**: PostHog + Google Analytics 4

### Data Flow

1. **Writes**: Save to IndexedDB first (instant UX)
2. **Sync**: Background upload to Supabase (every 5 minutes)
3. **Reads**: Always from IndexedDB (fast queries)
4. **Offline**: Full functionality without internet

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
npm run test

# Run tests once (no watch)
npm run test -- --run

# Run with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- sync-service
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E with UI
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug
```

### Manual Testing

See [Manual Testing Checklist](docs/MANUAL-TESTING-CHECKLIST.md) for comprehensive test scenarios.

## 🔐 Security

- **Row-Level Security (RLS)**: Database-level user data isolation
- **JWT Authentication**: Secure token-based sessions
- **Environment Variables**: Sensitive data never committed
- **Admin Protection**: Multi-layer access control
- **HTTPS Only**: Enforced in production

## 📊 Admin Dashboard

Access comprehensive analytics at `/admin/dashboard`:

**Features:**
- User metrics (total, active, onboarding completion)
- Run statistics (total runs, weekly runs, averages)
- User management table
- Quick links to PostHog and Google Analytics

**Access:** Configure admin emails in `ADMIN_EMAILS` environment variable.

## 🔄 Sync System

### How It Works

1. **Initial Sync**: Uploads all local data on first login
2. **Incremental Sync**: Only uploads changes since last sync
3. **Auto-Sync**: Runs every 5 minutes in background
4. **Manual Sync**: Triggered after completing runs
5. **Conflict Resolution**: Last-write-wins strategy

### Sync Status

The sync status indicator shows:
- ✅ **Synced** - All data up to date
- 🔄 **Syncing...** - Upload in progress
- ❌ **Error** - Sync failed (auto-retries)

## 🛠️ Development

### Project Structure

```
v0/
├── app/                    # Next.js app directory
│   ├── admin/              # Admin dashboard
│   ├── api/                # API routes
│   ├── auth/               # Authentication pages
│   └── (other routes)
├── components/             # React components
│   ├── ui/                 # UI primitives (Radix)
│   └── (feature components)
├── lib/                    # Utilities and services
│   ├── auth/               # Authentication context
│   ├── sync/               # Sync service
│   ├── db.ts               # Dexie database
│   └── supabase/           # Supabase clients
├── docs/                   # Documentation
├── e2e/                    # E2E tests
└── public/                 # Static assets
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues

# Testing
npm run test             # Run unit tests
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # E2E tests with UI

# Database
npx supabase db push     # Push migrations to Supabase
npx supabase db pull     # Pull schema from Supabase
```

### Adding a New Feature

1. **Create Components** - Add to `components/`
2. **Update Database** - Modify `lib/db.ts` if needed
3. **Add API Routes** - Create in `app/api/` if needed
4. **Update Sync** - Add to sync service if cloud sync needed
5. **Write Tests** - Add unit and E2E tests
6. **Update Docs** - Document in appropriate guide

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

See [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions.

### Environment Setup

1. Create Supabase project
2. Apply database migrations
3. Configure environment variables in Vercel
4. Deploy application
5. Verify all features working

## 📈 Performance

### Benchmarks

- **Local Data Access**: < 10ms
- **UI Navigation**: Instant (no page reloads)
- **Sync Time**: 2-5 seconds (100 records)
- **First Load**: < 2 seconds
- **Lighthouse Score**: 90+

### Optimizations

- Code splitting per route
- Dynamic imports for large components
- IndexedDB indexes for fast queries
- Batched sync uploads (100 records/batch)
- Image optimization with Next.js Image

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 🐛 Troubleshooting

### Common Issues

**Build Errors:**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Database Issues:**
```bash
# Reset local database
# Open DevTools Console and run:
await db.delete()
await db.open()
```

**Sync Not Working:**
- Check internet connection
- Verify Supabase environment variables
- Check browser console for errors
- Review sync status indicator

See [Troubleshooting Guide](docs/TROUBLESHOOTING.md) for more solutions.

## 📱 Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (iOS 12.2+)
- Mobile browsers: ✅ Optimized for mobile

### PWA Installation

**Desktop:**
1. Open app in browser
2. Click install icon in address bar
3. Follow prompts

**Mobile:**
1. Open app in browser
2. Tap "Add to Home Screen"
3. Confirm installation

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend infrastructure
- [Dexie.js](https://dexie.org/) - IndexedDB wrapper
- [Radix UI](https://www.radix-ui.com/) - UI components
- [OpenAI](https://openai.com/) - AI capabilities
- [Vercel](https://vercel.com/) - Hosting platform

## 📞 Support

- **Documentation**: See [`docs/`](docs/) directory
- **Issues**: [GitHub Issues](https://github.com/your-username/running-coach-app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/running-coach-app/discussions)

## 🗺️ Roadmap

### In Progress
- [ ] Bidirectional sync (cloud → local)
- [ ] Real-time collaboration features
- [ ] Mobile app (React Native)

### Planned
- [ ] Apple Watch integration
- [ ] Garmin Connect sync
- [ ] Strava integration
- [ ] Training load analytics
- [ ] Race prediction algorithms
- [ ] Social features (challenges, leaderboards)

### Completed
- [x] Authentication system ✅
- [x] Cloud sync ✅
- [x] Admin dashboard ✅
- [x] Device migration ✅
- [x] Analytics integration ✅

---

**Built with ❤️ by the RunSmart AI Team**

**Version**: 2.0.0
**Last Updated**: 2026-01-18
**Status**: Production Ready 🚀
