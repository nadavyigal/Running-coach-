import { describe, it, expect, beforeEach } from 'vitest'
import { findMatchingWorkout, confirmWorkoutCompletion } from './run-recording'
import { db, type Run, type Workout } from './db'

describe('run-recording - Workout Completion Loop', () => {
  let userId: number
  let planId: number

  beforeEach(async () => {
    // Create test user
    userId = await db.users.add({
      name: 'Test User',
      email: 'test@example.com',
      goal: 'habit',
      experience: 'beginner',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create test plan
    planId = await db.plans.add({
      userId,
      goal: 'habit',
      targetDistance: 10,
      targetPace: 330,
      weeksToGoal: 8,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('finds matching workout with exact distance and type match', async () => {
    const today = new Date()
    today.setHours(10, 0, 0, 0)

    // Create planned workout
    const workoutId = await db.workouts.add({
      planId,
      type: 'easy',
      distance: 5.0,
      duration: 30,
      pace: 330,
      scheduledDate: today,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create completed run with matching distance and type
    const runId = await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: today,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const run = await db.runs.get(runId)
    const matchedWorkout = await findMatchingWorkout(run!)

    expect(matchedWorkout).not.toBeNull()
    expect(matchedWorkout?.id).toBe(workoutId)
    expect(matchedWorkout?.type).toBe('easy')
  })

  it('matches workout within 20% distance tolerance', async () => {
    const today = new Date()
    today.setHours(10, 0, 0, 0)

    // Create planned workout for 5km
    const workoutId = await db.workouts.add({
      planId,
      type: 'easy',
      distance: 5.0,
      duration: 30,
      pace: 330,
      scheduledDate: today,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create run with 4.2km (16% under target - within tolerance)
    const runId = await db.runs.add({
      userId,
      type: 'easy',
      distance: 4.2,
      duration: 1386, // proportional duration
      pace: 330,
      calories: 252,
      completedAt: today,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const run = await db.runs.get(runId)
    const matchedWorkout = await findMatchingWorkout(run!)

    expect(matchedWorkout).not.toBeNull()
    expect(matchedWorkout?.id).toBe(workoutId)
  })

  it('requires matching workout type', async () => {
    const today = new Date()
    today.setHours(10, 0, 0, 0)

    // Create planned easy workout
    await db.workouts.add({
      planId,
      type: 'easy',
      distance: 5.0,
      duration: 30,
      pace: 330,
      scheduledDate: today,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create tempo run with matching distance
    const runId = await db.runs.add({
      userId,
      type: 'tempo', // Different type
      distance: 5.0,
      duration: 1500, // Faster pace
      pace: 300,
      calories: 300,
      completedAt: today,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const run = await db.runs.get(runId)
    const matchedWorkout = await findMatchingWorkout(run!)

    // Should not match because type is different
    expect(matchedWorkout).toBeNull()
  })

  it('rejects workout outside 20% distance tolerance', async () => {
    const today = new Date()
    today.setHours(10, 0, 0, 0)

    // Create planned workout for 5km
    await db.workouts.add({
      planId,
      type: 'easy',
      distance: 5.0,
      duration: 30,
      pace: 330,
      scheduledDate: today,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create run with 3.5km (30% under target - outside tolerance)
    const runId = await db.runs.add({
      userId,
      type: 'easy',
      distance: 3.5,
      duration: 1155,
      pace: 330,
      calories: 210,
      completedAt: today,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const run = await db.runs.get(runId)
    const matchedWorkout = await findMatchingWorkout(run!)

    // Should not match because distance is too far off
    expect(matchedWorkout).toBeNull()
  })

  it('does not match already completed workouts', async () => {
    const today = new Date()
    today.setHours(10, 0, 0, 0)

    // Create already completed workout
    await db.workouts.add({
      planId,
      type: 'easy',
      distance: 5.0,
      duration: 30,
      pace: 330,
      scheduledDate: today,
      completed: true, // Already completed
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create run with matching distance and type
    const runId = await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: today,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const run = await db.runs.get(runId)
    const matchedWorkout = await findMatchingWorkout(run!)

    // Should not match because workout is already completed
    expect(matchedWorkout).toBeNull()
  })

  it('confirms workout completion and updates database', async () => {
    const today = new Date()
    today.setHours(10, 0, 0, 0)

    // Create planned workout
    const workoutId = await db.workouts.add({
      planId,
      type: 'easy',
      distance: 5.0,
      duration: 30,
      pace: 330,
      scheduledDate: today,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create completed run
    const runId = await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: today,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const run = await db.runs.get(runId)
    const matchedWorkout = await confirmWorkoutCompletion(run!)

    expect(matchedWorkout).not.toBeNull()
    expect(matchedWorkout?.completed).toBe(true)
    expect(matchedWorkout?.actualDistanceKm).toBe(5.0)
    expect(matchedWorkout?.actualDurationMinutes).toBeCloseTo(27.5, 1) // 1650/60

    // Verify database was updated
    const updatedWorkout = await db.workouts.get(workoutId)
    expect(updatedWorkout?.completed).toBe(true)
  })

  it('returns null when no matching workout found', async () => {
    const today = new Date()
    today.setHours(10, 0, 0, 0)

    // No workouts created

    // Create run
    const runId = await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: today,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const run = await db.runs.get(runId)
    const matchedWorkout = await findMatchingWorkout(run!)

    expect(matchedWorkout).toBeNull()
  })

  it('matches closest workout when multiple candidates exist', async () => {
    const today = new Date()
    today.setHours(10, 0, 0, 0)

    // Create two planned workouts with similar distances
    await db.workouts.add({
      planId,
      type: 'easy',
      distance: 5.0,
      duration: 30,
      pace: 330,
      scheduledDate: today,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const closerWorkoutId = await db.workouts.add({
      planId,
      type: 'easy',
      distance: 5.5,
      duration: 33,
      pace: 330,
      scheduledDate: today,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create run closer to 5.5km
    const runId = await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.6,
      duration: 1848,
      pace: 330,
      calories: 336,
      completedAt: today,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const run = await db.runs.get(runId)
    const matchedWorkout = await findMatchingWorkout(run!)

    // Should match the 5.5km workout (closer)
    expect(matchedWorkout).not.toBeNull()
    expect(matchedWorkout?.id).toBe(closerWorkoutId)
    expect(matchedWorkout?.distance).toBe(5.5)
  })
})
