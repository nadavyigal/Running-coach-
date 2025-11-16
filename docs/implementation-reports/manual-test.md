# Manual Testing Guide for Running Coach App

## Current Status
✅ Application is running at http://localhost:3001
✅ Database is properly configured
✅ All dependencies are installed
✅ Environment variables are set up

## To Test the Full Functionality:

### 1. Open the Application
- Navigate to http://localhost:3001 in your browser
- You should see the "Welcome to Run-Smart!" screen with a green "Get Started" button

### 2. Complete the Onboarding Flow
**Step 1**: Click "Get Started" button
**Step 2**: Select your running goal (habit/distance/speed)
**Step 3**: Choose your experience level (beginner/occasional/regular)  
**Step 4**: Set your RPE (Rate of Perceived Exertion) - optional
**Step 5**: Enter your age (required)
**Step 6**: Select preferred running times and days per week
**Step 7**: Accept privacy consents (data processing and GDPR required)
**Step 8**: Review summary and click "Start My Journey"

### 3. Expected Results After Onboarding
- Application should create a user record in the database
- Generate a training plan (either AI-generated or fallback)
- Navigate to the "Today" screen
- Show bottom navigation with 5 tabs: Today, Plan, Record, Chat, Profile

### 4. Test Other Features
- **Today Screen**: Should show today's workout, streak counter, quick actions
- **Plan Screen**: Should display your generated training plan with workouts
- **Record Screen**: GPS-based run recording with real-time tracking
- **Chat Screen**: AI coach chat functionality (requires OpenAI API)
- **Profile Screen**: User settings, shoes, badges, streak information

## Troubleshooting

### If the "Get Started" Button Gets Stuck:
1. Open browser developer tools (F12)
2. Check the Console tab for any JavaScript errors
3. Clear browser storage: Application → Storage → Clear all
4. Refresh the page and try again

### If Plan Generation Fails:
- The app will fall back to a default plan if AI generation fails
- Check that OPENAI_API_KEY is properly set in .env.local
- Even without AI, the basic functionality should work

### Database Issues:
- The app uses IndexedDB (browser storage)
- Clear browser data if you encounter database issues
- No external database setup required

## What Makes It Fully Functional:

✅ **Frontend**: React components are properly set up
✅ **Database**: Dexie.js with IndexedDB for local storage
✅ **Navigation**: Screen-based navigation system
✅ **AI Integration**: OpenAI API for plan generation and chat
✅ **Analytics**: PostHog integration for user tracking
✅ **PWA Features**: Manifest file for mobile app-like experience
✅ **GPS Tracking**: Web Geolocation API for run recording

The application is now fully functional for testing!