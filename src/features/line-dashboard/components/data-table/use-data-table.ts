"use client"

import * as React from "react"
import type { SortingState } from "@tanstack/react-table"

import {
  DEFAULT_LIMIT,
  DEFAULT_TABLE,
  MIN_SAVING_VISIBLE_MS,
  SAVED_VISIBLE_MS,
  SAVING_DELAY_MS,
} from "./constants"
import type {
  CellIndicator,
  DataTableMeta,
  HandleUpdateFn,
  IndicatorTimers,
  TableOption,
} from "./types"
import { tableDataSchema, tablesResponseSchema } from "./types"

type UseDataTableArgs = {
  lineId: string
}

type UseDataTableReturn = {
  tables: TableOption[]
  selectedTable: string
  setSelectedTable: React.Dispatch<React.SetStateAction<string>>
  columns: string[]
  rows: Array<Record<string, unknown>>
  limit: number
  setLimit: React.Dispatch<React.SetStateAction<number>>
  appliedLimit: number
  filter: string
  setFilter: React.Dispatch<React.SetStateAction<string>>
  sorting: SortingState
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>
  isLoadingTables: boolean
  isLoadingRows: boolean
  tableListError: string | null
  rowsError: string | null
  lastFetchedCount: number
  fetchRows: () => Promise<void>
  tableMeta: DataTableMeta
}

export function useDataTableState({ lineId }: UseDataTableArgs): UseDataTableReturn {
  const [tables, setTables] = React.useState<TableOption[]>([])
  const [selectedTable, setSelectedTable] = React.useState<string>("")
  const [columns, setColumns] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<Array<Record<string, unknown>>>([])
  const [limit, setLimit] = React.useState<number>(DEFAULT_LIMIT)
  const [appliedLimit, setAppliedLimit] = React.useState<number>(DEFAULT_LIMIT)
  const [filter, setFilter] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [commentDrafts, setCommentDrafts] = React.useState<Record<string, string>>({})
  const [commentEditing, setCommentEditing] = React.useState<Record<string, boolean>>({})
  const [needToSendDrafts, setNeedToSendDrafts] = React.useState<Record<string, number>>({})
  const [updatingCells, setUpdatingCells] = React.useState<Record<string, boolean>>({})
  const [updateErrors, setUpdateErrors] = React.useState<Record<string, string>>({})
  const [cellIndicators, setCellIndicators] = React.useState<Record<string, CellIndicator>>({})

  const [isLoadingTables, setIsLoadingTables] = React.useState(false)
  const [isLoadingRows, setIsLoadingRows] = React.useState(false)
  const [tableListError, setTableListError] = React.useState<string | null>(null)
  const [rowsError, setRowsError] = React.useState<string | null>(null)
  const [lastFetchedCount, setLastFetchedCount] = React.useState(0)

  const tablesRequestRef = React.useRef(0)
  const rowsRequestRef = React.useRef(0)
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
      const timersByKey = timersRef.current
      Object.values(timersByKey).forEach((timers) => {
        if (timers.savingDelay) clearTimeout(timers.savingDelay)
        if (timers.transition) clearTimeout(timers.transition)
        if (timers.savedCleanup) clearTimeout(timers.savedCleanup)
      })
      timersRef.current = {}
      activeKeysRef.current.clear()
    }
  }, [])

  const fetchTables = React.useCallback(async () => {
    const requestId = ++tablesRequestRef.current
    setIsLoadingTables(true)
    setTableListError(null)
    try {
      const response = await fetch("/api/tables", { cache: "no-store" })
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
      const json = await response.json()
      const parsed = tablesResponseSchema.safeParse(json)
      if (!parsed.success) throw new Error("Received unexpected data from server")
      if (tablesRequestRef.current !== requestId) return

      const nextTables = parsed.data.tables
      setTables(nextTables)
      if (nextTables.length === 0) {
        setSelectedTable("")
        return
      }
      setSelectedTable((previous) => {
        if (!previous) {
          const preferred =
            nextTables.find((o) => o.fullName === DEFAULT_TABLE || o.name === DEFAULT_TABLE) ??
            nextTables[0]
          return preferred.fullName
        }
        const matchByFull = nextTables.find((o) => o.fullName === previous)
        if (matchByFull) return matchByFull.fullName
        const matchByName = nextTables.find((o) => o.name === previous)
        if (matchByName) return matchByName.fullName
        const fallback =
          nextTables.find((o) => o.fullName === DEFAULT_TABLE || o.name === DEFAULT_TABLE) ??
          nextTables[0]
        return fallback.fullName
      })
    } catch (e) {
      if (tablesRequestRef.current !== requestId) return
      const message = e instanceof Error ? e.message : "Failed to load table list"
      setTableListError(message)
      setTables([])
      setSelectedTable("")
    } finally {
      if (tablesRequestRef.current === requestId) setIsLoadingTables(false)
    }
  }, [])

  const fetchRows = React.useCallback(async () => {
    if (!selectedTable) {
      setColumns([])
      setRows([])
      setRowsError(null)
      setLastFetchedCount(0)
      return
    }
    const requestId = ++rowsRequestRef.current
    setIsLoadingRows(true)
    setRowsError(null)
    try {
      const params = new URLSearchParams({ table: selectedTable, limit: String(limit) })
      if (lineId) {
        params.set("lineId", lineId)
      }
      const response = await fetch(`/api/tables?${params.toString()}`, { cache: "no-store" })
      if (!response.ok) {
        const json = await response.json().catch(() => ({}))
        const msg = typeof json.error === "string" ? json.error : `Request failed with status ${response.status}`
        throw new Error(msg)
      }
      const json = await response.json()
      const parsed = tableDataSchema.safeParse(json)
      if (!parsed.success) throw new Error("Received unexpected data from server")
      if (rowsRequestRef.current !== requestId) return

      const { columns: fetchedColumns, rows: fetchedRows } = parsed.data
      setColumns(fetchedColumns)
      setRows(fetchedRows)
      setLastFetchedCount(parsed.data.rowCount)
      setAppliedLimit(parsed.data.limit)
      setCommentDrafts({})
      setCommentEditing({})
      setNeedToSendDrafts({})
      if (parsed.data.table && parsed.data.table !== selectedTable) {
        setSelectedTable(parsed.data.table)
      }
    } catch (e) {
      if (rowsRequestRef.current !== requestId) return
      const message = e instanceof Error ? e.message : "Failed to load table rows"
      setRowsError(message)
      setColumns([])
      setRows([])
      setLastFetchedCount(0)
    } finally {
      if (rowsRequestRef.current === requestId) setIsLoadingRows(false)
    }
  }, [limit, selectedTable, lineId])

  React.useEffect(() => {
    void fetchTables()
  }, [fetchTables])

  React.useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const clearUpdateError = React.useCallback((key: string) => {
    setUpdateErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const getTimerEntry = React.useCallback((key: string): IndicatorTimers => {
    const existing = indicatorTimersRef.current[key]
    if (existing) return existing
    const created: IndicatorTimers = {}
    indicatorTimersRef.current[key] = created
    return created
  }, [])

  const clearTimer = React.useCallback(
    (key: string, timerName: keyof IndicatorTimers) => {
      const entry = indicatorTimersRef.current[key]
      if (!entry) return
      const timer = entry[timerName]
      if (timer !== undefined) {
        clearTimeout(timer)
        delete entry[timerName]
      }
    },
    []
  )

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

  const beginCellIndicators = React.useCallback(
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

  const finalizeCellIndicators = React.useCallback(
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
        const runWithMinimum = (task: () => void) => {
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
          runWithMinimum(() => {
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
          runWithMinimum(() => {
            if (activeIndicatorKeysRef.current.has(key)) return
            removeIndicatorImmediate(key, ["saving"])
          })
        }
      })
    },
    [clearTimer, getTimerEntry, removeIndicatorImmediate]
  )

  const handleUpdate = React.useCallback<HandleUpdateFn>(
    async (recordId, updates) => {
      const fields = Object.keys(updates) as Array<"comment" | "needtosend">
      if (!recordId || fields.length === 0) return false
      if (!selectedTable) {
        fields.forEach((field) => {
          const key = `${recordId}:${field}`
          setUpdateErrors((prev) => ({
            ...prev,
            [key]: "Select a table before editing.",
          }))
        })
        return false
      }

      const cellKeys = fields.map((field) => `${recordId}:${field}`)

      setUpdatingCells((prev) => {
        const next = { ...prev }
        cellKeys.forEach((key) => {
          next[key] = true
        })
        return next
      })

      setUpdateErrors((prev) => {
        const next = { ...prev }
        cellKeys.forEach((key) => {
          if (key in next) delete next[key]
        })
        return next
      })

      beginCellIndicators(cellKeys)

      let updateSucceeded = false

      try {
        const response = await fetch("/api/tables/update", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            table: selectedTable,
            id: recordId,
            updates,
          }),
        })

        if (!response.ok) {
          const json = await response.json().catch(() => ({}))
          const message =
            typeof json.error === "string"
              ? json.error
              : `Failed to update (status ${response.status})`
          throw new Error(message)
        }

        setRows((previousRows) =>
          previousRows.map((row) => {
            const rowId = String((row as { id?: unknown }).id ?? "")
            if (rowId !== recordId) return row
            return {
              ...row,
              ...updates,
            }
          })
        )

        if ("comment" in updates) {
          setCommentDrafts((prev) => {
            const next = { ...prev }
            delete next[recordId]
            return next
          })
          setCommentEditing((prev) => {
            if (!(recordId in prev)) return prev
            const next = { ...prev }
            delete next[recordId]
            return next
          })
        }

        if ("needtosend" in updates) {
          setNeedToSendDrafts((prev) => {
            const next = { ...prev }
            delete next[recordId]
            return next
          })
        }

        updateSucceeded = true
        return true
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update"

        setUpdateErrors((prev) => {
          const next = { ...prev }
          cellKeys.forEach((key) => {
            next[key] = message
          })
          return next
        })

        return false
      } finally {
        setUpdatingCells((prev) => {
          const next = { ...prev }
          cellKeys.forEach((key) => {
            delete next[key]
          })
          return next
        })
        finalizeCellIndicators(cellKeys, updateSucceeded ? "success" : "error")
      }
    },
    [selectedTable, beginCellIndicators, finalizeCellIndicators]
  )

  const setCommentEditingState = React.useCallback((recordId: string, editing: boolean) => {
    if (!recordId) return
    setCommentEditing((prev) => {
      if (editing) {
        return {
          ...prev,
          [recordId]: true,
        }
      }
      if (!(recordId in prev)) return prev
      const next = { ...prev }
      delete next[recordId]
      return next
    })
  }, [])

  const setCommentDraftValue = React.useCallback((recordId: string, value: string) => {
    if (!recordId) return
    setCommentDrafts((prev) => ({
      ...prev,
      [recordId]: value,
    }))
  }, [])

  const removeCommentDraftValue = React.useCallback((recordId: string) => {
    if (!recordId) return
    setCommentDrafts((prev) => {
      if (!(recordId in prev)) return prev
      const next = { ...prev }
      delete next[recordId]
      return next
    })
  }, [])

  const setNeedToSendDraftValue = React.useCallback((recordId: string, value: number) => {
    if (!recordId) return
    setNeedToSendDrafts((prev) => ({
      ...prev,
      [recordId]: value,
    }))
  }, [])

  const removeNeedToSendDraftValue = React.useCallback((recordId: string) => {
    if (!recordId) return
    setNeedToSendDrafts((prev) => {
      if (!(recordId in prev)) return prev
      const next = { ...prev }
      delete next[recordId]
      return next
    })
  }, [])

  const tableMeta = React.useMemo<DataTableMeta>(
    () => ({
      commentDrafts,
      commentEditing,
      needToSendDrafts,
      updatingCells,
      updateErrors,
      selectedTable,
      cellIndicators,
      clearUpdateError,
      setCommentDraftValue,
      removeCommentDraftValue,
      setCommentEditingState,
      setNeedToSendDraftValue,
      removeNeedToSendDraftValue,
      handleUpdate,
    }),
    [
      commentDrafts,
      commentEditing,
      needToSendDrafts,
      updatingCells,
      updateErrors,
      selectedTable,
      cellIndicators,
      clearUpdateError,
      setCommentDraftValue,
      removeCommentDraftValue,
      setCommentEditingState,
      setNeedToSendDraftValue,
      removeNeedToSendDraftValue,
      handleUpdate,
    ]
  )

  return {
    tables,
    selectedTable,
    setSelectedTable,
    columns,
    rows,
    limit,
    setLimit,
    appliedLimit,
    filter,
    setFilter,
    sorting,
    setSorting,
    isLoadingTables,
    isLoadingRows,
    tableListError,
    rowsError,
    lastFetchedCount,
    fetchRows,
    tableMeta,
  }
}
