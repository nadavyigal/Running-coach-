---
name: ios-expert
description: >
  iOS expert agent for RunSmart native app development. Handles SwiftUI architecture,
  HealthKit integration, App Store deployment, and monorepo coordination with the web app.
  Use when working on any iOS-related development, planning, or platform decisions.
metadata:
  short-description: Native iOS development expert with SwiftUI, HealthKit, and App Store skills.
  category: ios
  agent-file: ../../.claude/agents/ios-expert.md
  skills-included:
    - ios-swiftui-patterns
    - architecture-patterns
    - swift-health-kit
    - mobile-ios-design
    - asc-release-flow
    - monorepo-management
---

## When to Use This Skill

- Planning or building the RunSmart iOS app
- Any SwiftUI development work
- HealthKit integration for fitness/health data
- iOS architecture decisions (MVVM, TCA, Clean)
- App Store submission and TestFlight distribution
- Setting up monorepo structure for web + iOS
- GPS/Location tracking implementation
- Push notifications and background tasks
- Offline sync and SwiftData persistence
- Apple Human Interface Guidelines compliance

## Sub-Skills Reference

This agent composes knowledge from 6 installed skills:

1. **ios-swiftui-patterns** — SwiftUI views, state (@State, @Binding, @Observable), declarative UI
2. **architecture-patterns** — MVVM, TCA, Clean Architecture selection and implementation
3. **swift-health-kit** — HealthKit authorization, health samples, workouts, background delivery
4. **mobile-ios-design** — Apple HIG, SF Symbols, Dynamic Type, Dark Mode, accessibility
5. **asc-release-flow** — TestFlight builds, App Store submission, release workflows
6. **monorepo-management** — Turborepo, pnpm workspaces, shared packages, CI/CD

## Usage

Invoke the agent for iOS tasks:
```
Use the ios-expert agent to [describe iOS task]
```

Or reference the agent file directly:
```
.claude/agents/ios-expert.md
```

## Adding More Skills

Install new skills and add them to the agent:
```bash
npx skills add <owner/repo@skill-name> -g -y
```
Then update both `.claude/agents/ios-expert.md` (skills table) and this file (skills-included list).
