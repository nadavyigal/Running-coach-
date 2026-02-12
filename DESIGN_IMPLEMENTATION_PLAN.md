# RunSmart Bold Athletic Minimalism Design Implementation Plan

## Context & Current State

This document provides a comprehensive plan for continuing the frontend design enhancement of RunSmart, implementing the **Bold Athletic Minimalism** design philosophy across all application screens.

### Branch Information
- **Branch:** `new-design`
- **Base Branch:** `main`
- **Commit:** f481c9b - "feat(design): implement Bold Athletic Minimalism design system"

### What Has Been Completed (Phase 1 & Partial Phase 2)

#### ✅ Phase 1: Global Design System (100% Complete)

**Files Modified:**
- `v0/app/globals.css` - Added 220 lines of design tokens and utilities
- `v0/tailwind.config.ts` - Extended theme with athletic colors and animations

**Design Tokens Added:**
```css
/* Neon Accents */
--neon-cyan: 180 100% 50%;
--neon-yellow: 52 100% 65%;
--neon-pink: 330 100% 50%;

/* Athletic Neutrals */
--black: 0 0% 4%;
--gray-900: 0 0% 10%;
/* ... complete neutral scale */

/* Optical Spacing */
--space-xs through --space-3xl

/* Athletic Border Radius */
--radius-sm through --radius-full

/* Animation Timing */
--ease-smooth, --ease-bounce, --ease-snap
--duration-fast, --duration-normal, --duration-slow
```

**Utility Classes Created:**
- Typography: `.text-display-xl` (96px), `.text-display-lg` (72px), `.text-display-md` (48px)
- Headings: `.text-heading-xl/lg/md`
- Labels: `.text-label-lg/sm` (uppercase with letter-spacing)
- Gradients: `.bg-gradient-energy/focus/recovery/success`
- Glow Effects: `.glow-cyan/yellow/pink`
- Animations: `.animate-pulse-glow`, `.animate-slide-in-right`, `.animate-morph`
- Noise Texture: `.noise-overlay::after`

**Tailwind Extensions:**
- Custom colors: `neon.cyan/yellow/pink`, `athletic.black/gray/white`
- Custom border radius: `athletic-sm/md/lg/xl/full`
- Custom spacing: `xs/sm/md/lg/xl/2xl/3xl`
- Custom timing functions: `smooth/bounce/snap`
- Custom animations with keyframes

#### ✅ Phase 2: High-Impact Screens (40% Complete)

**1. Race Goals Screen** ✅ (`v0/components/race-goals-screen.tsx`)
- Giant distance watermark (128px font, gray-100, background)
- Gradient priority badges (A: red→orange, B: amber→yellow, C: blue→cyan)
- Color-coded left border (4px) matching priority
- Enhanced typography (text-label-sm, tabular-nums, monospace)
- Countdown with slash separator ("42 / DAYS LEFT")
- Animated buttons (hover lift, scale, gradient)
- Header with text-heading-xl

**2. Chat Screen** ✅ (`v0/components/chat-screen.tsx`)
- User messages: Neon cyan border with glow, gradient background
- AI messages: Gradient purple→pink with noise texture overlay
- Coaching adaptations: Purple-themed badges
- Floating input bar: Backdrop blur, large rounded inputs, focus glow
- Circular gradient send button with scale animation

### What Needs to Be Done (Phase 2 Continuation & Beyond)

## Phase 2: Remaining High-Impact Screens

### 3. Today Screen (Priority 1)

**File:** `v0/components/today-screen.tsx`

**Objectives:**
1. Implement Hero Zone (top 40%): Giant recovery score ring
2. Redesign stats grid with Bento layout
3. Enhance calendar strip with timeline-style nodes
4. Improve today's workout card with split-screen layout

**Specific Changes:**

#### Recovery Score Redesign
```tsx
// Replace current recovery widget with:
<div className="relative">
  {/* Giant circular progress ring (180px diameter) */}
  <svg className="w-48 h-48 transform -rotate-90">
    <circle
      cx="96"
      cy="96"
      r="88"
      className="stroke-gray-200"
      strokeWidth="16"
      fill="none"
    />
    <circle
      cx="96"
      cy="96"
      r="88"
      className={scoreColor} // Color-coded: red/amber/green
      strokeWidth="16"
      fill="none"
      strokeDasharray={`${(score / 100) * 553} 553`}
      strokeLinecap="round"
    />
  </svg>

  {/* Score in center */}
  <div className="absolute inset-0 flex flex-col items-center justify-center">
    <span className="text-display-lg font-black">{score}</span>
    <span className="text-label-sm text-gray-600">RECOVERY</span>
    <span className="text-xs text-green-600 flex items-center gap-1">
      +5 pts ↑
    </span>
  </div>
</div>

// Add radial gradient background matching score color
```

#### Today's Workout Card - Split Screen
```tsx
<Card className="overflow-hidden">
  <div className="grid grid-cols-2 gap-0">
    {/* Left: Workout Details */}
    <div className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
      <Badge className="bg-white/20 text-white mb-3">
        {workoutType}
      </Badge>
      <h3 className="text-heading-lg">{distance}km</h3>
      <p className="text-sm opacity-90 mt-2">{description}</p>

      {/* Large background distance */}
      <span className="absolute bottom-4 left-4 text-[6rem] font-black text-white/10">
        {distance}
      </span>
    </div>

    {/* Right: Start Button */}
    <div className="p-6 flex items-center justify-center bg-gray-50">
      <Button className="h-32 w-32 rounded-full bg-gradient-energy
                         shadow-2xl animate-pulse-glow">
        <Play className="h-12 w-12" />
      </Button>
    </div>
  </div>
</Card>
```

#### Stats Grid - Bento Layout
```tsx
<div className="grid grid-cols-3 gap-4">
  {/* Streak - Double width */}
  <div className="col-span-2 bg-gradient-to-br from-emerald-400 to-teal-500
                  rounded-3xl p-6 text-white">
    <span className="text-display-md font-black">{streak}</span>
    <span className="text-label-sm block mt-2">DAY STREAK</span>
  </div>

  {/* Weekly Runs */}
  <div className="bg-white rounded-3xl p-6 border-2 border-gray-100
                  hover:shadow-xl hover:-translate-y-1 transition-all">
    <span className="text-5xl font-black">{weeklyRuns}</span>
    <span className="text-label-sm block mt-2 text-gray-600">THIS WEEK</span>
  </div>

  {/* Consistency */}
  <div className="bg-white rounded-3xl p-6 border-2 border-gray-100
                  hover:shadow-xl hover:-translate-y-1 transition-all">
    <span className="text-5xl font-black">{consistency}%</span>
    <span className="text-label-sm block mt-2 text-gray-600">CONSISTENCY</span>
  </div>

  {/* Completed */}
  <div className="col-span-2 bg-white rounded-3xl p-6 border-2 border-gray-100
                  hover:shadow-xl hover:-translate-y-1 transition-all">
    <span className="text-5xl font-black">{completed}/{total}</span>
    <span className="text-label-sm block mt-2 text-gray-600">WORKOUTS COMPLETED</span>
  </div>
</div>
```

#### Calendar Strip - Timeline Nodes
```tsx
<ScrollArea className="w-full whitespace-nowrap">
  <div className="flex gap-2 pb-4">
    {days.map((day, idx) => (
      <div key={idx} className="flex flex-col items-center">
        {/* Timeline node */}
        <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center
                        transition-all duration-300
                        ${day.isToday
                          ? 'bg-gradient-energy border-orange-500 scale-125 shadow-xl'
                          : 'bg-white border-gray-200'}`}>
          <span className="font-bold">{day.date}</span>
        </div>

        {/* Workout indicator */}
        {day.hasWorkout && (
          <div className={`mt-2 w-2 h-2 rounded-full glow-cyan bg-cyan-400`} />
        )}

        <span className="text-xs mt-1 text-gray-600">{day.name}</span>
      </div>
    ))}
  </div>
</ScrollArea>
```

**Color Palette for Today Screen:**
```tsx
const recoveryColors = {
  good: 'stroke-emerald-500 from-emerald-400 to-teal-500',
  fair: 'stroke-amber-500 from-amber-400 to-orange-500',
  low: 'stroke-rose-500 from-rose-400 to-red-500'
}

const workoutGradient = 'from-indigo-500 to-purple-600'
const backgroundTexture = 'bg-zinc-50 noise-overlay'
```

---

### 4. Record Run Screen (Priority 2)

**File:** `v0/components/record-screen.tsx`

**Objectives:**
1. Giant metrics display (72px font)
2. GPS signal strength bars
3. Dark mode map with gradient stroke
4. Circular controls with glow effects

**Specific Changes:**

#### Metrics Dashboard
```tsx
<div className="space-y-6">
  {/* Primary Metric - Distance */}
  <div className="text-center">
    <span className="text-display-xl font-black tabular-nums">
      {distance.toFixed(2)}
    </span>
    <span className="text-label-lg ml-2 text-gray-600">KM</span>

    {/* Circular progress ring for distance goal */}
    {distanceGoal && (
      <svg className="w-64 h-64 mx-auto">
        {/* Ring showing progress to goal */}
      </svg>
    )}
  </div>

  {/* Pace - Color coded */}
  <div className={`text-center p-6 rounded-3xl ${paceZoneColor}`}>
    <span className="text-label-sm">CURRENT PACE</span>
    <div className="text-display-md font-black tabular-nums mt-2">
      {pace}
    </div>
    <Badge className="mt-2">{paceZone}</Badge>
  </div>

  {/* Time */}
  <div className="text-center">
    <span className="text-label-sm text-gray-600">TIME ELAPSED</span>
    <div className="text-display-lg font-mono font-black tabular-nums mt-2">
      {formatTime(elapsed)}
    </div>
  </div>
</div>

// Pace zone colors
const paceZones = {
  easy: 'bg-gradient-to-r from-lime-400 to-green-500 text-white',
  moderate: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white',
  hard: 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
}
```

#### GPS Accuracy - Signal Bars
```tsx
<div className="flex items-center gap-2">
  <span className="text-label-sm text-gray-600">GPS</span>
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(bar => (
      <div
        key={bar}
        className={`w-1 rounded-full transition-all ${
          bar <= signalStrength
            ? 'bg-green-500 h-4'
            : 'bg-gray-300 h-2'
        }`}
        style={{ height: `${bar * 4}px` }}
      />
    ))}
  </div>
  <span className={`text-xs ${signalColor}`}>
    {signalQuality}
  </span>
</div>
```

#### Map Enhancement
```tsx
// Add dark mode tiles
const mapTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

// Gradient polyline based on pace
<Polyline
  positions={route}
  pathOptions={{
    weight: 6,
    opacity: 0.8,
    // Segments colored by pace (fast=red, moderate=yellow, slow=green)
  }}
/>

// Pulsing current position
<CircleMarker
  center={currentPosition}
  radius={12}
  className="animate-pulse-glow"
  pathOptions={{
    color: '#00FFFF',
    fillColor: '#00FFFF',
    fillOpacity: 0.5
  }}
/>
```

#### Controls Redesign
```tsx
{/* Start/Pause Button */}
<button className="w-32 h-32 rounded-full bg-gradient-to-r from-green-600 to-emerald-600
                   shadow-2xl hover:shadow-3xl transition-all duration-300
                   hover:scale-110 active:scale-95 glow-cyan">
  {isRecording ? <Pause className="h-16 w-16" /> : <Play className="h-16 w-16" />}
</button>

{/* Stop Button - Long Press */}
<button
  onMouseDown={startLongPress}
  onMouseUp={cancelLongPress}
  className="w-24 h-24 rounded-full border-4 border-red-600
             flex items-center justify-center relative
             hover:bg-red-50 transition-all">
  <Square className="h-12 w-12 text-red-600" />

  {/* Circular progress for long-press */}
  {isPressingStop && (
    <svg className="absolute inset-0 -rotate-90">
      <circle
        cx="48"
        cy="48"
        r="44"
        className="stroke-red-600"
        strokeWidth="4"
        fill="none"
        strokeDasharray={`${longPressProgress * 276} 276`}
      />
    </svg>
  )}
</button>
```

**Color Palette:**
```tsx
const recordScreenColors = {
  background: 'bg-slate-900',
  accent: 'text-cyan-400 glow-cyan',
  danger: 'text-red-500 glow-pink',
  text: 'text-white',
  textSecondary: 'text-gray-400'
}
```

---

### 5. Professional Landing Screen (Priority 3)

**File:** `v0/components/professional-landing-screen.tsx`

**Objectives:**
1. Full-screen diagonal split hero
2. Huge custom icons (120px) in features
3. Inline form with large inputs
4. Asymmetric features grid

**Specific Changes:**

#### Hero Section - Diagonal Split
```tsx
<section className="relative min-h-screen overflow-hidden">
  {/* Left 60% - Text & CTA */}
  <div className="absolute inset-0 w-3/5 bg-gradient-to-br from-orange-500 via-rose-500 to-purple-600
                  flex items-center justify-center p-12">
    <div className="max-w-2xl">
      <h1 className="text-display-xl text-white mb-6 leading-none">
        TRAIN
        <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
          SMARTER
        </span>
      </h1>

      <p className="text-2xl text-white/90 mb-8 leading-relaxed">
        AI-powered running coach that adapts to your goals, schedule, and fitness level
      </p>

      {/* CTA */}
      <Button className="h-16 px-12 text-lg bg-neon-yellow text-black
                         rounded-2xl shadow-2xl hover:shadow-3xl
                         transition-all duration-300 hover:scale-105
                         font-black uppercase tracking-wide">
        Start Free Trial
        <ArrowRight className="ml-3 h-6 w-6" />
      </Button>
    </div>
  </div>

  {/* Right 40% - Animated Graphic */}
  <div className="absolute right-0 top-0 bottom-0 w-2/5 bg-black
                  flex items-center justify-center">
    {/* Runner silhouette with motion lines */}
    <div className="relative">
      <img
        src="/runner-silhouette.svg"
        alt="Runner"
        className="w-96 h-96 animate-pulse-glow"
      />
      {/* Motion lines */}
      <div className="absolute -left-12 top-1/2 space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-1 bg-gradient-to-r from-cyan-400 to-transparent rounded-full"
            style={{
              width: `${(5-i) * 40}px`,
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>
    </div>
  </div>

  {/* Diagonal divider */}
  <div className="absolute inset-0 w-full h-full pointer-events-none">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <path d="M 60 0 L 100 0 L 100 100 L 40 100 Z" fill="black" />
    </svg>
  </div>
</section>
```

#### Features Grid - Asymmetric
```tsx
<section className="py-24 px-6">
  <div className="max-w-7xl mx-auto">
    {/* 2-1-2-1 pattern */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Row 1: 2 features */}
      <FeatureCard
        icon={<Brain className="w-32 h-32" />}
        title="AI Coaching"
        description="Personalized plans that adapt"
        gradient="from-purple-600 to-pink-600"
        className="md:col-span-1"
      />
      <FeatureCard
        icon={<Target className="w-32 h-32" />}
        title="Goal Tracking"
        description="Achieve your race goals"
        gradient="from-orange-600 to-red-600"
        className="md:col-span-2"
      />

      {/* Row 2: 1 feature (full width) */}
      <FeatureCard
        icon={<Activity className="w-40 h-40" />}
        title="Real-time GPS"
        description="Track every step with precision"
        gradient="from-cyan-600 to-blue-600"
        className="md:col-span-3"
      />

      {/* Row 3: 2 features */}
      <FeatureCard
        icon={<Heart className="w-32 h-32" />}
        title="Recovery"
        description="Science-based rest days"
        gradient="from-emerald-600 to-teal-600"
        className="md:col-span-2"
      />
      <FeatureCard
        icon={<Trophy className="w-32 h-32" />}
        title="Challenges"
        description="21-day programs"
        gradient="from-amber-600 to-yellow-600"
        className="md:col-span-1"
      />
    </div>
  </div>
</section>

// Feature Card Component
function FeatureCard({ icon, title, description, gradient, className }) {
  return (
    <div className={`group relative overflow-hidden rounded-3xl p-12
                    bg-gradient-to-br ${gradient} text-white
                    hover:shadow-2xl hover:-translate-y-2
                    transition-all duration-500 ${className}`}>
      {/* Icon */}
      <div className="mb-6 transform group-hover:rotate-12 transition-transform duration-500">
        {icon}
      </div>

      {/* Text */}
      <h3 className="text-heading-xl mb-3">{title}</h3>
      <p className="text-lg opacity-90">{description}</p>

      {/* Noise overlay */}
      <div className="absolute inset-0 noise-overlay opacity-10" />
    </div>
  )
}
```

#### Beta Signup Form - Inline
```tsx
<section className="py-16 px-6 bg-gray-50">
  <div className="max-w-2xl mx-auto text-center">
    <h2 className="text-display-md mb-6">Join the Beta</h2>
    <p className="text-xl text-gray-600 mb-8">
      Be among the first to experience AI-powered running coaching
    </p>

    <form className="space-y-4">
      <Input
        placeholder="Your name"
        className="h-16 text-lg px-6 rounded-2xl border-2 border-gray-300
                   focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20
                   transition-all"
      />
      <Input
        type="email"
        placeholder="Email address"
        className="h-16 text-lg px-6 rounded-2xl border-2 border-gray-300
                   focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20
                   transition-all"
      />

      <Button className="w-full h-16 text-lg bg-gradient-energy
                         rounded-2xl shadow-xl hover:shadow-2xl
                         transition-all duration-300 hover:scale-105
                         font-bold">
        Get Early Access
      </Button>
    </form>

    {/* Social Proof */}
    <div className="mt-8 flex items-center justify-center gap-2 text-gray-600">
      <div className="flex -space-x-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-8 h-8 rounded-full bg-gradient-focus border-2 border-white" />
        ))}
      </div>
      <span className="text-sm">
        <span className="font-bold text-gray-900">{betaCount}</span> runners already signed up
      </span>
    </div>
  </div>
</section>
```

---

## Phase 3: Secondary Screens (Week 5-6)

### 6. Plan Screen

**File:** `v0/components/plan-screen.tsx`

**Key Changes:**
- Replace workout color dots with branded gradient system
- Horizontal timeline layout for week cards
- Giant week distance numbers on left edge (vertical text)
- Segmented progress bar with workout type colors
- Current week elevated card with glow shadow

### 7. Profile Screen

**File:** `v0/components/profile-screen.tsx`

**Key Changes:**
- Giant lifetime stats (96px font) with animated counters
- Radial progress rings around stats
- Trophy shelf metaphor for badge cabinet
- Card-based settings navigation
- Horizontal timeline for goal progress

### 8. Onboarding Screen

**File:** `v0/components/onboarding-screen.tsx`

**Key Changes:**
- Bold typography (Bebas Neue style with existing fonts)
- Large background step numbers (200px, opacity 5%)
- Duotone gradients for backgrounds
- Asymmetric layouts
- Chunky segmented progress bar
- Wheel picker with haptic feedback simulation

### 9. Challenges Screen

**File:** Infer from challenge-related components

**Key Changes:**
- Illustrated headers for challenge cards
- Multi-segment progress ring (21 segments)
- Animated checkmarks for completed days
- Full-screen celebration modal with confetti
- 3D flip animation for badge unlock

---

## Phase 4: Polish & Testing (Week 7-8)

### Performance Optimization
1. **Animation Performance Audit**
   - Use Chrome DevTools Performance tab
   - Ensure all animations use `transform` and `opacity` only
   - Add `will-change` for frequently animated elements
   - Profile frame rate during animations (target: 60fps)

2. **Bundle Size Check**
   - Run `npm run build` and analyze bundle
   - Ensure design tokens don't bloat CSS
   - Check for unused utility classes

3. **Lighthouse Scores**
   - Performance: 90+ (mobile)
   - Accessibility: 100
   - Best Practices: 100
   - SEO: 100

### Accessibility Audit
1. **Color Contrast Testing**
   - Use WebAIM Contrast Checker
   - Ensure all text meets WCAG AA (4.5:1 for normal, 3:1 for large)
   - Test gradients for readability across all color stops

2. **Keyboard Navigation**
   - Tab through all interactive elements
   - Verify visible focus indicators
   - Test skip links
   - Ensure all buttons are keyboard-accessible

3. **Screen Reader Testing**
   - Test with NVDA (Windows) or VoiceOver (Mac)
   - Verify aria-labels on icon-only buttons
   - Check aria-live regions for dynamic content
   - Ensure progress indicators have accessible labels

### Cross-Browser Testing
- Chrome (Desktop & Mobile)
- Safari (Desktop & iOS)
- Firefox (Desktop)
- Edge (Desktop)

### Responsive Testing
- Mobile: 375px, 390px, 428px
- Tablet: 768px, 1024px
- Desktop: 1280px, 1440px, 1920px

---

## Implementation Tips

### Working with the Design System

**Using Gradient Backgrounds:**
```tsx
// Energy gradient (sunset run)
<div className="bg-gradient-energy">

// Focus gradient (intense purple)
<div className="bg-gradient-focus">

// Recovery gradient (cool blues)
<div className="bg-gradient-recovery">

// Success gradient (emerald)
<div className="bg-gradient-success">
```

**Using Typography Utilities:**
```tsx
// Giant display text
<h1 className="text-display-xl">CRUSH YOUR GOALS</h1>

// Section headers
<h2 className="text-heading-xl">Race Goals</h2>

// Uppercase labels
<span className="text-label-lg">DAYS LEFT</span>
```

**Using Glow Effects:**
```tsx
// Cyan glow
<div className="glow-cyan">

// Yellow glow
<Button className="bg-neon-yellow glow-yellow">

// Pink glow
<div className="border-neon-pink glow-pink">
```

**Using Animations:**
```tsx
// Pulsing glow
<div className="animate-pulse-glow">

// Slide in from right
<div className="animate-slide-in-right">

// Morph border radius
<div className="animate-morph">
```

**Using Noise Texture:**
```tsx
// Add subtle texture overlay
<div className="relative noise-overlay">
  <p className="relative z-10">Content here</p>
</div>
```

### Code Patterns to Follow

**Button Enhancements:**
```tsx
// Primary CTA with gradient and scale
<Button className="bg-gradient-to-r from-cyan-500 to-blue-500
                   shadow-lg hover:shadow-xl
                   transition-all duration-300
                   hover:scale-105 active:scale-95">

// Secondary with hover lift
<Button variant="outline"
        className="transition-all duration-200 hover:-translate-y-0.5">
```

**Card Enhancements:**
```tsx
// Elevated card with hover
<Card className="hover:shadow-xl transition-all duration-300
                hover:-translate-y-1 relative overflow-hidden">
  {/* Content */}
</Card>

// Card with color-coded border
<Card className="border-l-4 border-red-600">

// Card with background number watermark
<Card className="relative overflow-hidden">
  <span className="absolute top-4 right-4 text-[8rem] font-black
                   text-gray-100 leading-none select-none pointer-events-none">
    42
  </span>
  <div className="relative z-10">
    {/* Content */}
  </div>
</Card>
```

**Input Field Enhancements:**
```tsx
<Input className="h-16 px-6 rounded-2xl border-2 border-gray-200
                  bg-gray-50
                  focus:bg-white focus:border-cyan-500
                  focus:ring-4 focus:ring-cyan-500/20
                  transition-all duration-200
                  placeholder:text-gray-400" />
```

### Performance Considerations

**GPU-Accelerated Animations:**
```tsx
// ✅ Good - uses transform and opacity
<div className="transition-transform hover:scale-105">
<div className="transition-opacity hover:opacity-80">

// ❌ Bad - forces layout recalculation
<div className="transition-all hover:w-64">
<div className="transition-all hover:left-10">
```

**Will-Change for Frequent Animations:**
```tsx
// For elements that animate frequently
<div className="animate-pulse-glow" style={{ willChange: 'transform, opacity' }}>
```

---

## Testing Checklist

### Visual QA
- [ ] All screens match design philosophy
- [ ] Typography hierarchy is clear
- [ ] Color usage is consistent
- [ ] Animations are smooth (60fps)
- [ ] Spacing feels balanced
- [ ] No visual bugs on mobile
- [ ] Dark mode (if applicable) works

### Functional QA
- [ ] All interactive elements work
- [ ] Forms submit correctly
- [ ] Navigation flows properly
- [ ] Data persists correctly
- [ ] Error states display properly
- [ ] Loading states are clear

### Performance QA
- [ ] Lighthouse score 90+
- [ ] No layout shift (CLS < 0.1)
- [ ] Fast first paint (FCP < 1.8s)
- [ ] Time to interactive (TTI < 3.8s)
- [ ] Animations don't drop frames

### Accessibility QA
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Focus indicators visible
- [ ] Color contrast passes WCAG AA
- [ ] Touch targets ≥ 44x44px
- [ ] Alt text on images

---

## Success Metrics

### Quantitative
- Onboarding completion rate: 80%+
- Daily active user retention: 40%+ (Day 7)
- Feature engagement: Record Run 3+ times/week
- Page load performance: Lighthouse 90+

### Qualitative
- Brand perception: "Athletic", "Modern", "Energetic"
- Visual distinctiveness: Users identify RunSmart without branding
- Emotional response: Excitement when opening app
- Competitive differentiation: Visually distinct from Nike Run Club, Strava

---

## Prompt for New Chat Session

Use this prompt when starting a new chat to continue this work:

```
I'm continuing the frontend design enhancement for RunSmart running coach PWA.

CONTEXT:
- Branch: new-design (already pushed to GitHub)
- Design philosophy: Bold Athletic Minimalism
- Full plan: DESIGN_IMPLEMENTATION_PLAN.md in project root

COMPLETED (Phase 1 & 2 Partial):
✅ Global design system (design tokens, utilities, animations)
✅ Race Goals screen (gradient badges, giant watermarks, enhanced typography)
✅ Chat screen (neon borders, gradient bubbles, floating input bar)

NEXT PRIORITY (Phase 2 Continuation):
1. Today screen - Recovery ring, Bento grid stats, timeline calendar
2. Record Run screen - Giant metrics, GPS signal bars, dark map
3. Professional Landing - Diagonal hero, asymmetric features

Please read DESIGN_IMPLEMENTATION_PLAN.md and continue with the Today screen implementation following the specific changes outlined in the plan. Maintain the Bold Athletic Minimalism design philosophy with:
- Ultra-bold typography
- Duotone gradients and neon accents
- Kinetic micro-interactions
- Giant background numbers
- GPU-accelerated animations

Let's start with the Today screen's recovery score giant circular ring (180px diameter).
```

---

## Files Reference

### Modified Files (Committed)
- `v0/app/globals.css` - Design tokens and utilities
- `v0/tailwind.config.ts` - Theme extensions
- `v0/components/race-goals-screen.tsx` - Enhanced with gradients and watermarks
- `v0/components/chat-screen.tsx` - Enhanced with neon borders and floating input

### Files to Modify (Pending)
- `v0/components/today-screen.tsx` - Recovery ring, Bento grid, timeline calendar
- `v0/components/record-screen.tsx` - Giant metrics, GPS bars, dark map
- `v0/components/professional-landing-screen.tsx` - Diagonal hero, asymmetric features
- `v0/components/plan-screen.tsx` - Timeline layout, branded colors
- `v0/components/profile-screen.tsx` - Giant stats, trophy shelf
- `v0/components/onboarding-screen.tsx` - Bold typography, asymmetric layouts
- Challenge-related components - Illustrated headers, progress rings

### Design Report
Full analysis and recommendations: `C:\Users\nadav\.claude\plans\warm-questing-walrus.md`

---

## Questions & Support

If you encounter issues:
1. Review the design tokens in `globals.css`
2. Check Tailwind extensions in `tailwind.config.ts`
3. Reference completed screens (Race Goals, Chat) for patterns
4. Consult the full design report for detailed rationale

Happy coding! 🎨✨
