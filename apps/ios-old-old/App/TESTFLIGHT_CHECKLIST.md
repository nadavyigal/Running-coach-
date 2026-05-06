# RunSmart - TestFlight & App Store Submission Checklist

**Last Updated:** April 20, 2026
**Target Release:** Version 1.0.0

---

## ✅ COMPLETED ITEMS
- [x] Email verification bug fixed
- [x] GPS location tracking issue fixed
- [x] Release configuration created (release.xcconfig)

---

## 📋 PHASE 1: XCODE PROJECT CONFIGURATION

### A. Build Configurations
- [ ] **Link release.xcconfig to Release configuration**
  1. Open Xcode project
  2. Select project in navigator → Info tab
  3. Under Configurations → Release → Based on configuration file → Select `release.xcconfig`
  4. Clean build folder (Cmd + Shift + K)
  5. Rebuild project to verify

### B. Info.plist - Required Privacy Descriptions
Verify these entries exist in your Info.plist:

- [ ] **NSLocationWhenInUseUsageDescription**
  ```
  "RunSmart needs access to your location to accurately track your running distance, pace, and route."
  ```

- [ ] **NSLocationAlwaysAndWhenInUseUsageDescription**
  ```
  "RunSmart needs continuous location access to track your runs even when the app is in the background."
  ```

- [ ] **NSMotionUsageDescription** (if using pedometer/motion data)
  ```
  "RunSmart uses motion sensors to track your steps, cadence, and running form."
  ```

- [ ] **NSHealthShareUsageDescription** (if integrating with HealthKit)
  ```
  "RunSmart reads your health data to provide personalized training insights and track your fitness progress."
  ```

- [ ] **NSHealthUpdateUsageDescription** (if writing to HealthKit)
  ```
  "RunSmart saves your workout data to Apple Health so you can see all your fitness activities in one place."
  ```

- [ ] **NSPhotoLibraryUsageDescription** (if allowing photo uploads)
  ```
  "RunSmart needs access to your photos to let you share run achievements and progress pictures."
  ```

- [ ] **NSCameraUsageDescription** (if using camera)
  ```
  "RunSmart uses your camera to capture and share your running achievements."
  ```

### C. App Icons & Assets
- [ ] App Icon set with all required sizes:
  - [ ] 1024x1024 (App Store)
  - [ ] 180x180 (iPhone @3x)
  - [ ] 120x120 (iPhone @2x)
  - [ ] 167x167 (iPad Pro)
  - [ ] 152x152 (iPad @2x)
  - [ ] 76x76 (iPad)
  - [ ] All other required sizes in Assets.xcassets

- [ ] Launch Screen configured (LaunchScreen.storyboard or Launch Image set)

### D. Signing & Capabilities
- [ ] Team selected in "Signing & Capabilities"
- [ ] Bundle Identifier is unique (e.g., com.yourcompany.runsmart)
- [ ] Required capabilities enabled:
  - [ ] Background Modes (if needed)
    - [ ] Location updates
    - [ ] Background fetch (if applicable)
  - [ ] Push Notifications (if using)
  - [ ] HealthKit (if integrating with Apple Health)
  - [ ] Sign in with Apple (if using)

- [ ] Distribution certificate created in Apple Developer account
- [ ] App Store provisioning profile created

### E. Version & Build Numbers
- [ ] Version number set (recommended: 1.0.0 for first release)
  - Location: Target → General → Identity → Version
- [ ] Build number set (must be unique for each upload, e.g., 1)
  - Location: Target → General → Identity → Build

### F. Build Settings Review
- [ ] Deployment Target set appropriately (iOS 14.0+ recommended)
- [ ] Supported Devices: iPhone (or Universal if supporting iPad)
- [ ] Supported Orientations configured
- [ ] Status bar style configured
- [ ] Requires full screen (set appropriately)

---

## 📋 PHASE 2: CODE & FUNCTIONALITY REVIEW

### A. Complete QA Testing
Reference: QA_SESSION_LOG.md

- [ ] TEST 2: Authentication (3 min)
- [ ] TEST 3: First Run Recording (8 min)
- [ ] TEST 4: Background Test (3 min)
- [ ] TEST 5: Run History (2 min)
- [ ] TEST 6: AI Coach (3 min)
- [ ] TEST 7: Garmin Sync (2 min)
- [ ] TEST 8: Training Plan (2 min)
- [ ] TEST 9: Offline Test (2 min)
- [ ] TEST 10: App State Test (3 min)

### B. Physical Device Testing
- [ ] Test on at least one physical iPhone (not just simulator)
- [ ] Test actual GPS tracking outdoors
- [ ] Test background location tracking on real device
- [ ] Verify battery usage is reasonable
- [ ] Test with Location Services disabled → show proper error
- [ ] Test app permissions flow (first launch)

### C. Edge Cases & Error Handling
- [ ] Poor/no internet connection handling
- [ ] Airplane mode functionality
- [ ] App backgrounding during active run
- [ ] App force-quit during active run
- [ ] Low battery scenarios
- [ ] Location permission denied scenarios
- [ ] Proper error messages (user-friendly, not technical)

### D. Performance Checks
- [ ] App launch time < 3 seconds
- [ ] No memory leaks during extended use
- [ ] Smooth scrolling in lists/maps
- [ ] No crashes in normal usage
- [ ] Background location doesn't drain battery excessively

---

## 📋 PHASE 3: APP STORE CONNECT SETUP

### A. Create App Record
Go to: https://appstoreconnect.apple.com

- [ ] Log in with Apple Developer account
- [ ] Click "My Apps" → "+" → "New App"
- [ ] Fill in required information:
  - [ ] Platform: iOS
  - [ ] Name: RunSmart (must be unique on App Store)
  - [ ] Primary Language: English (or your preference)
  - [ ] Bundle ID: Select the one matching your Xcode project
  - [ ] SKU: Unique identifier (e.g., RUNSMART-001)
  - [ ] User Access: Full Access

### B. Prepare App Metadata
Have these ready before submission:

**Required Text Content:**
- [ ] **App Name** (max 30 characters)
  - Example: "RunSmart"
  
- [ ] **Subtitle** (max 30 characters)
  - Example: "AI-Powered Run Tracking"
  
- [ ] **Description** (max 4000 characters)
  - Highlight key features
  - Benefits for users
  - What makes your app unique
  - Clear, engaging copy
  
- [ ] **Keywords** (max 100 characters, comma-separated)
  - Example: "running,training,GPS,fitness,workout,tracker,coach"
  
- [ ] **Promotional Text** (max 170 characters, can be updated anytime)
  - Used for seasonal promotions or updates
  
- [ ] **Support URL** (required)
  - Must be a working website with contact/support information
  
- [ ] **Marketing URL** (optional)
  - Your product marketing page
  
- [ ] **Privacy Policy URL** (required if collecting user data)
  - **CRITICAL:** Required for location tracking and user accounts
  - Must be a publicly accessible webpage

**Category & Age Rating:**
- [ ] Primary Category: Health & Fitness
- [ ] Secondary Category (optional): Sports or Lifestyle
- [ ] Age Rating: Complete questionnaire (likely 4+)

### C. Prepare Screenshots
**Required for iPhone:**
- [ ] 6.7" Display (iPhone 14 Pro Max, 15 Pro Max) - 1290 x 2796 pixels
  - Minimum 1 screenshot, maximum 10
  - Must show actual app functionality
  - Can include text overlays explaining features

**Optional but Recommended:**
- [ ] 6.5" Display (iPhone 11 Pro Max, XS Max)
- [ ] 5.5" Display (iPhone 8 Plus) - if supporting older devices

**Screenshot Content Suggestions:**
1. Login/Welcome screen with key feature highlights
2. Active run tracking screen with map
3. Run history/statistics view
4. AI Coach recommendations
5. Training plan overview
6. Garmin sync/integrations

**Tips:**
- Use Xcode Simulator or real device screenshots
- Show your app in the best light
- Add text overlays to explain features (optional)
- Keep screenshots up-to-date with current UI

### D. App Preview Video (Optional but Recommended)
- [ ] 30-second video showing app in action
- [ ] Same sizes as screenshots
- [ ] Shows key features and user flow
- [ ] No longer than 30 seconds

### E. App Review Information
- [ ] **Contact Information**
  - First Name, Last Name
  - Phone Number
  - Email Address
  
- [ ] **Demo Account** (if app requires login)
  - **CRITICAL:** Provide working test credentials
  - Username/Email
  - Password
  - Any special instructions for reviewers
  
- [ ] **Notes for Reviewers**
  - Explain how to test location features
  - Any specific test scenarios
  - Known limitations or requirements

### F. Export Compliance
- [ ] Does your app use encryption? 
  - If only using HTTPS, answer "No"
  - Most apps using standard iOS frameworks = No

---

## 📋 PHASE 4: BUILD & UPLOAD TO TESTFLIGHT

### A. Prepare for Archive
- [ ] Clean Build Folder
  - Xcode → Product → Clean Build Folder (Cmd + Shift + K)
  
- [ ] Select "Any iOS Device (arm64)" as build destination
  - **NOT** a simulator
  
- [ ] Verify Release scheme is selected
  - Product → Scheme → Edit Scheme → Archive → Build Configuration = Release

### B. Create Archive
- [ ] Product → Archive
- [ ] Wait for archive to complete (may take several minutes)
- [ ] Verify archive appears in Organizer window

### C. Distribute to TestFlight
In Organizer window:

1. [ ] Select your archive
2. [ ] Click "Distribute App"
3. [ ] Select "App Store Connect"
4. [ ] Select "Upload"
5. [ ] Select your distribution certificate and provisioning profile
6. [ ] Review content:
   - [ ] Include bitcode (if enabled)
   - [ ] Upload symbols for crash reporting
   - [ ] Manage Version and Build Number automatically
7. [ ] Click "Upload"
8. [ ] Wait for "Upload Successful" confirmation

### D. Post-Upload Processing
- [ ] Log into App Store Connect
- [ ] Go to TestFlight tab
- [ ] Wait for build to process (5-30 minutes typically)
- [ ] Check for any processing errors
- [ ] Once "Ready to Submit" appears, build is ready for testing

---

## 📋 PHASE 5: TESTFLIGHT TESTING

### A. Internal Testing (Your Team)
- [ ] Add internal testers in TestFlight
  - App Store Connect → TestFlight → Internal Testing
  - Add team members (up to 100)
  - No review required
  
- [ ] Set up test groups
  - Create group (e.g., "Core Team")
  - Add testers
  - Enable automatic distribution for new builds
  
- [ ] Testers receive email invitation
- [ ] Testers download TestFlight app from App Store
- [ ] Testers install and test your app

### B. External Testing (Beta Users) - Optional before release
- [ ] Create external test group
- [ ] Add external testers (up to 10,000)
- [ ] **First external build requires App Review** (1-2 days)
- [ ] Provide "What to Test" information for reviewers
- [ ] Wait for approval
- [ ] Distribute to external testers

### C. Collect Feedback
- [ ] Monitor crash reports in App Store Connect
- [ ] Review tester feedback
- [ ] Track analytics (if integrated)
- [ ] Fix critical bugs
- [ ] Prepare update builds if needed

### D. Iterate
For each new build:
- [ ] Increment build number (e.g., 1 → 2 → 3)
- [ ] Archive and upload new build
- [ ] Add "What's New" notes for testers
- [ ] Repeat testing cycle

---

## 📋 PHASE 6: FINAL APP STORE SUBMISSION

### A. Pre-Submission Checklist
- [ ] All critical bugs fixed
- [ ] TestFlight feedback addressed
- [ ] Final build uploaded and processed
- [ ] All metadata complete in App Store Connect
- [ ] Screenshots uploaded
- [ ] Privacy Policy URL active and accessible
- [ ] Support URL active and accessible
- [ ] Demo account credentials working (if applicable)

### B. Submit for Review
- [ ] Go to App Store Connect → My Apps → RunSmart
- [ ] Select the version (1.0.0)
- [ ] Choose your final build from TestFlight
- [ ] Review all information one last time
- [ ] Click "Submit for Review"
- [ ] Answer questionnaire:
  - Advertising Identifier usage
  - Content Rights
  - Government Export Compliance
  
### C. App Review Process
- [ ] **Waiting for Review** (typically 24-48 hours)
- [ ] **In Review** (typically 24-48 hours)
- [ ] Possible outcomes:
  - **Approved** → Proceed to release
  - **Rejected** → Address issues and resubmit
  - **Metadata Rejected** → Fix metadata issues only
  - **Developer Rejected** → You pulled submission

### D. Release
Once approved:

- [ ] Choose release option:
  - **Manual Release:** You control when app goes live
  - **Automatic Release:** Goes live immediately upon approval
  - **Scheduled Release:** Goes live on specific date/time
  
- [ ] If manual: Click "Release This Version" when ready
- [ ] App appears on App Store within 24 hours

---

## 📋 POST-LAUNCH ACTIVITIES

### A. Monitor Performance
- [ ] Watch for crash reports
- [ ] Monitor user reviews and ratings
- [ ] Check download statistics
- [ ] Review search rankings for keywords

### B. User Support
- [ ] Respond to user reviews (especially negative ones)
- [ ] Monitor support email/URL
- [ ] Document common issues

### C. Plan Updates
- [ ] Prioritize bug fixes
- [ ] Plan feature improvements
- [ ] Schedule regular updates (every 2-4 weeks recommended)

---

## 🚨 COMMON REJECTION REASONS TO AVOID

1. **Missing/Inadequate Privacy Policy**
   - Must clearly explain data collection and usage
   - Must be accessible without downloading the app

2. **Location Services Not Clearly Explained**
   - Info.plist descriptions must be clear and user-friendly
   - Must explain WHY you need location, not just WHAT you do

3. **Crashes or Major Bugs**
   - Test thoroughly on physical devices
   - Always test the exact build you're submitting

4. **Incomplete Information**
   - Missing screenshots
   - Missing demo account
   - Broken support URL

5. **Misleading Screenshots/Metadata**
   - Screenshots must show actual app functionality
   - No fake features or misleading information

6. **Objectionable Content**
   - Complete age rating questionnaire accurately
   - Ensure content is appropriate for rating

7. **Minimum Functionality**
   - App must offer substantial, unique value
   - No "test" apps or minimal functionality

---

## 📞 SUPPORT RESOURCES

**Apple Developer Support:**
- Developer Forums: https://developer.apple.com/forums/
- Technical Support: https://developer.apple.com/support/
- App Review: https://developer.apple.com/app-store/review/

**Documentation:**
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- App Store Connect Help: https://help.apple.com/app-store-connect/
- TestFlight Guide: https://developer.apple.com/testflight/

---

## 🎯 ESTIMATED TIMELINE

- **Phase 1-2 (Configuration & Testing):** 1-2 days
- **Phase 3 (App Store Connect Setup):** 2-4 hours
- **Phase 4 (First Upload):** 1-2 hours
- **Phase 5 (TestFlight Testing):** 3-7 days
- **Phase 6 (App Review):** 2-5 days
- **TOTAL:** ~1-2 weeks from start to App Store approval

---

## ✅ QUICK START - IMMEDIATE NEXT STEPS

1. **TODAY:**
   - [ ] Link release.xcconfig to Release configuration in Xcode
   - [ ] Verify all Info.plist privacy descriptions
   - [ ] Complete remaining QA tests (2-10)
   - [ ] Test on physical device

2. **THIS WEEK:**
   - [ ] Create App Store Connect app record
   - [ ] Prepare screenshots and app description
   - [ ] Set up distribution certificate and provisioning
   - [ ] Create first archive and upload to TestFlight

3. **NEXT WEEK:**
   - [ ] Internal testing with team
   - [ ] Fix any discovered issues
   - [ ] Prepare final build
   - [ ] Submit for App Store review

Good luck with your RunSmart app launch! 🚀
