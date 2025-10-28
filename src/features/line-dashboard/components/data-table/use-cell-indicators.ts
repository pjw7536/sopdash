"use client"

import * as React from "react"

import {
  MIN_SAVING_VISIBLE_MS,
  SAVED_VISIBLE_MS,
  SAVING_DELAY_MS,
} from "./constants"
import type { CellIndicator, IndicatorTimers } from "./types"

function clearAllTimers(timers: IndicatorTimers) {
  if (timers.savingDelay) clearTimeout(timers.savingDelay)
  if (timers.transition) clearTimeout(timers.transition)
  if (timers.savedCleanup) clearTimeout(timers.savedCleanup)
}

type UseCellIndicatorsReturn = {
  cellIndicators: Record<string, CellIndicator>
  begin: (keys: string[]) => void
  finalize: (keys: string[], outcome: "success" | "error") => void
}

export function useCellIndicators(): UseCellIndicatorsReturn {
  const [cellIndicators, setCellIndicators] = React.useState<Record<string, CellIndicator>>({})
  const cellIndicatorsRef = React.useRef(cellIndicators)
  const indicatorTimersRef = React.useRef<Record<string, IndicatorTimers>>({})
  const activeIndicatorKeysRef = React.useRef(new Set<string>())

  React.useEffect(() => {
    cellIndicatorsRef.current = cellIndicators
  }, [cellIndicators])

  React.useEffect(() => {
    const timersRef = indicatorTimersRef
    const activeKeysRef = activeIndicatorKeysRef

    return () => {
      Object.values(timersRef.current).forEach(clearAllTimers)
      timersRef.current = {}
      activeKeysRef.current.clear()
    }
  }, [])

  const getTimerEntry = React.useCallback((key: string): IndicatorTimers => {
    const existing = indicatorTimersRef.current[key]
    if (existing) return existing
    const created: IndicatorTimers = {}
    indicatorTimersRef.current[key] = created
    return created
  }, [])

  const clearTimer = React.useCallback((key: string, timerName: keyof IndicatorTimers) => {
    const entry = indicatorTimersRef.current[key]
    if (!entry) return
    const timer = entry[timerName]
    if (timer !== undefined) {
      clearTimeout(timer)
      delete entry[timerName]
    }
  }, [])

  const removeIndicatorImmediate = React.useCallback(
    (key: string, allowedStatuses?: Array<CellIndicator["status"]>) => {
      setCellIndicators((prev) => {
        const current = prev[key]
        if (!current) return prev
        if (allowedStatuses && !allowedStatuses.includes(current.status)) {
          return prev
        }
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    []
  )

  const begin = React.useCallback(
    (keys: string[]) => {
      if (keys.length === 0) return

      setCellIndicators((prev) => {
        let next: typeof prev | null = null
        keys.forEach((key) => {
          if (key in prev) {
            if (next === null) next = { ...prev }
            delete next[key]
          }
        })
        return next ?? prev
      })

      keys.forEach((key) => {
        activeIndicatorKeysRef.current.add(key)
        const timers = getTimerEntry(key)
        clearTimer(key, "savingDelay")
        clearTimer(key, "transition")
        clearTimer(key, "savedCleanup")
        timers.savingDelay = setTimeout(() => {
          delete timers.savingDelay
          if (!activeIndicatorKeysRef.current.has(key)) return
          setCellIndicators((prev) => ({
            ...prev,
            [key]: { status: "saving", visibleSince: Date.now() },
          }))
        }, SAVING_DELAY_MS)
      })
    },
    [clearTimer, getTimerEntry]
  )

  const finalize = React.useCallback(
    (keys: string[], outcome: "success" | "error") => {
      if (keys.length === 0) return
      const now = Date.now()

      keys.forEach((key) => {
        activeIndicatorKeysRef.current.delete(key)
        clearTimer(key, "savingDelay")
        clearTimer(key, "transition")
        clearTimer(key, "savedCleanup")
        const timers = getTimerEntry(key)
        const indicator = cellIndicatorsRef.current[key]

        const runWithMinimumVisible = (task: () => void) => {
          if (indicator && indicator.status === "saving") {
            const elapsed = now - indicator.visibleSince
            const wait = Math.max(0, MIN_SAVING_VISIBLE_MS - elapsed)
            if (wait > 0) {
              timers.transition = setTimeout(() => {
                delete timers.transition
                task()
              }, wait)
              return
            }
          }
          task()
        }

        if (outcome === "success") {
          runWithMinimumVisible(() => {
            if (activeIndicatorKeysRef.current.has(key)) return
            setCellIndicators((prev) => ({
              ...prev,
              [key]: { status: "saved", visibleSince: Date.now() },
            }))
            timers.savedCleanup = setTimeout(() => {
              delete timers.savedCleanup
              if (activeIndicatorKeysRef.current.has(key)) return
              removeIndicatorImmediate(key, ["saved"])
            }, SAVED_VISIBLE_MS)
          })
        } else {
          runWithMinimumVisible(() => {
            if (activeIndicatorKeysRef.current.has(key)) return
            removeIndicatorImmediate(key, ["saving"])
          })
        }
      })
    },
    [clearTimer, getTimerEntry, removeIndicatorImmediate]
  )

  return { cellIndicators, begin, finalize }
}
