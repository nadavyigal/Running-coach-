# Date Picker Investigation Report

## Issue Summary
Date picker in Configure Intervals screen (AddRunModal) is not working:
- Mobile Chrome: Calendar doesn't open at all
- Web browser: Calendar may open but dates are not selectable/clickable

## Investigation Results

### Component Structure Analysis

#### 1. Dialog Implementation (✓ CORRECT)
- **File**: `V0/components/ui/dialog.tsx`
- Uses `@radix-ui/react-dialog@1.1.4`
- DialogContent has `z-50` (standard)
- DialogOverlay has `z-50` with `bg-black/80`
- Has proper Portal rendering
- **Finding**: Dialog is properly configured

#### 2. Popover Implementation (⚠️ ISSUE IDENTIFIED)
- **File**: `V0/components/ui/popover.tsx`
- Uses `@radix-ui/react-popover@1.1.14` (latest)
- PopoverContent has `z-[100]` (higher than Dialog's z-50)
- Uses Portal rendering correctly
- **Finding**: Z-index is HIGHER than Dialog, which is correct

#### 3. Calendar Implementation (✓ CORRECT)
- **File**: `V0/components/ui/calendar.tsx`
- Uses `react-day-picker@9.8.0` (v9 API)
- Proper classNames for day cells
- Uses `buttonVariants({ variant: "ghost" })` for day buttons
- **Finding**: Calendar implementation looks correct

#### 4. AddRunModal Implementation (🔴 ROOT CAUSE IDENTIFIED)
- **File**: `V0/components/add-run-modal.tsx`
- Lines 688-707: Popover and Calendar implementation
- **CRITICAL FINDING**: Missing `mode="single"` was added, but there's a deeper issue

### ROOT CAUSE ANALYSIS

#### Problem 1: Dialog max-height causes overflow issues
**Line 470**: `DialogContent className="max-w-md max-h-[90vh] overflow-y-auto"`

When the Dialog has `overflow-y-auto`, it creates a scroll container. The Popover Portal tries to position itself relative to the trigger, but the scrolling context can interfere with touch/click event handling, especially on mobile.

#### Problem 2: Popover might be getting clipped or positioned incorrectly
The Popover uses Portal to render outside the Dialog, but the positioning calculations might be affected by:
1. The Dialog's transform (translate-x-[-50%] translate-y-[-50%])
2. The Dialog's animation states
3. The scrollable container

#### Problem 3: Mobile touch event handling
On mobile, the Dialog overlay might be intercepting touch events before they reach the Popover content, especially if the Popover is rendered in the Portal but the event handlers aren't properly set up.

#### Problem 4: react-day-picker v9 button interaction
Looking at the Calendar component, the day cells use:
```typescript
day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100")
```

The `buttonVariants` creates a button-like element, but if react-day-picker v9 doesn't attach proper click handlers or if those handlers are being blocked, dates won't be selectable.

### Z-Index Stack
1. Dialog Overlay: z-50
2. Dialog Content: z-50
3. Popover Content: z-[100] ✓ (correct, higher than Dialog)

### Version Analysis
- `@radix-ui/react-dialog`: 1.1.4
- `@radix-ui/react-popover`: 1.1.14 (latest)
- `react-day-picker`: 9.8.0 (using v9 API)

All versions are current and compatible.

## Solutions to Implement

### Solution 1: Fix Portal Container and Event Handling (RECOMMENDED)
The Popover needs to be able to handle events properly even when rendered in a Portal outside the Dialog.

### Solution 2: Add explicit event handlers to Calendar
react-day-picker v9 might need explicit event configuration.

### Solution 3: Fix Dialog overflow context
The Dialog's `overflow-y-auto` might need to be handled differently to not interfere with Popover positioning.

### Solution 4: Add mobile-specific touch handling
Mobile devices might need explicit touch-action CSS properties.

## Proposed Fix Strategy

1. Add `modal={false}` to Dialog to prevent focus trapping that might interfere with Popover
2. Add explicit `onDayClick` handler to Calendar (v9 might need this)
3. Add `container` prop to PopoverContent to ensure proper Portal mounting
4. Add mobile-friendly CSS for touch interactions
5. Ensure Popover trigger button has proper pointer events
6. Add debugging console logs to track state changes

## Files to Modify
1. `V0/components/add-run-modal.tsx` - Main fix location
2. Possibly `V0/components/ui/popover.tsx` - If Portal container needs adjustment
3. Possibly `V0/components/ui/calendar.tsx` - If explicit handlers needed
