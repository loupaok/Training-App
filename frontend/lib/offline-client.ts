"use client"

import { api } from "@/lib/api/client"

type OfflineSet = {
  exerciseName: string
  exerciseId: number | null
  setNumber: number
  targetReps: number
  repsCompleted: number
  weightKg: number
  setType: string
}

export type PendingOfflineWorkout = {
  id: string
  clientId: number
  trainingPlanId: number
  dayNumber: number
  dayName: string
  durationSeconds: number
  totalSetsCompleted: number
  totalVolumeKg: number
  notes: string
  workoutFeeling: string | null
  sets: OfflineSet[]
  createdAt: string
}

const cacheKey = (clientId: number, resource: string) => `offline-client:${clientId}:${resource}`
const queueKey = (clientId: number) => cacheKey(clientId, "workout-queue")

export const isOnline = () => typeof navigator === "undefined" || navigator.onLine

export function readOfflineData<T>(clientId: number, resource: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(cacheKey(clientId, resource))
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

export function cacheOfflineData<T>(clientId: number, resource: string, value: T) {
  if (typeof window === "undefined") return
  try { window.localStorage.setItem(cacheKey(clientId, resource), JSON.stringify(value)) } catch { /* Storage may be full. */ }
}

function readQueue(clientId: number): PendingOfflineWorkout[] {
  if (typeof window === "undefined") return []
  try {
    const value = JSON.parse(window.localStorage.getItem(queueKey(clientId)) || "[]")
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeQueue(clientId: number, workouts: PendingOfflineWorkout[]) {
  if (typeof window === "undefined") return
  try { window.localStorage.setItem(queueKey(clientId), JSON.stringify(workouts)) } catch { /* Storage may be full. */ }
}

export function createOfflineWorkoutId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function queueOfflineWorkout(workout: PendingOfflineWorkout) {
  const queue = readQueue(workout.clientId)
  const next = queue.filter((item) => item.id !== workout.id)
  next.push(workout)
  writeQueue(workout.clientId, next)
}

export async function syncOfflineWorkouts(clientId: number) {
  if (!isOnline()) return 0
  const queue = readQueue(clientId)
  let synced = 0

  for (const workout of queue) {
    try {
      const started = await api.post<{ workoutLogId: number }>("/client/workout/start", {
        trainingPlanId: workout.trainingPlanId,
        dayNumber: workout.dayNumber,
        dayName: workout.dayName,
        offlineSyncId: workout.id,
      })
      await Promise.all(workout.sets.map((set) => api.post("/client/workout/log-set", { workoutLogId: started.workoutLogId, ...set })))
      await api.post("/client/workout/complete", {
        workoutLogId: started.workoutLogId,
        durationSeconds: workout.durationSeconds,
        totalSetsCompleted: workout.totalSetsCompleted,
        totalVolumeKg: workout.totalVolumeKg,
        notes: workout.notes,
        workoutFeeling: workout.workoutFeeling,
        offlineSyncId: workout.id,
      })
      writeQueue(clientId, readQueue(clientId).filter((item) => item.id !== workout.id))
      synced += 1
    } catch {
      break
    }
  }

  return synced
}
