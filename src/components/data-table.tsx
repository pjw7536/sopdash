"use client"

import * as React from "react"
import {
  IconAlertCircle,
  IconDatabase,
  IconLoader,
  IconReload,
  IconChevronUp,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react"
import { z } from "zod"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table"
import type { Row } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────
// 기존 상수/스키마/유틸은 그대로 사용
// ─────────────────────────────────────────────────────────
const DEFAULT_TABLE = "drone_sop_v3"
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 1000

const tableOptionSchema = z.object({
  schema: z.string().nullable(),
  name: z.string(),
  fullName: z.string(),
})

const tablesResponseSchema = z.object({
  tables: z.array(tableOptionSchema),
})

const tableDataSchema = z.object({
  table: z.string(),
  limit: z.number(),
  rowCount: z.number(),
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
})

type TableOption = z.infer<typeof tableOptionSchema>
type HandleUpdateFn = (
  recordId: string,
  updates: {
    comment?: string
    needtosend?: number
  }
) => Promise<boolean>

type CellIndicator = {
  status: "saving" | "saved"
  visibleSince: number
}

type IndicatorTimers = {
  savingDelay?: ReturnType<typeof setTimeout>
  transition?: ReturnType<typeof setTimeout>
  savedCleanup?: ReturnType<typeof setTimeout>
}

type DataTableMeta = {
  commentDrafts: Record<string, string>
  commentEditing: Record<string, boolean>
  needToSendDrafts: Record<string, number>
  updatingCells: Record<string, boolean>
  updateErrors: Record<string, string>
  selectedTable: string
  cellIndicators: Record<string, CellIndicator>
  clearUpdateError: (key: string) => void
  setCommentDraftValue: (recordId: string, value: string) => void
  removeCommentDraftValue: (recordId: string) => void
  setCommentEditingState: (recordId: string, editing: boolean) => void
  setNeedToSendDraftValue: (recordId: string, value: number) => void
  removeNeedToSendDraftValue: (recordId: string) => void
  handleUpdate: HandleUpdateFn
}

const SAVING_DELAY_MS = 180
const MIN_SAVING_VISIBLE_MS = 500
const SAVED_VISIBLE_MS = 800

const numberFormatter = new Intl.NumberFormat()
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

const clampLimit = (value: number) =>
  Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT)

// ── 셀/검색 렌더링 유틸 (기존 유지) ───────────────────────
function formatCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">NULL</span>
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE"
  if (typeof value === "number" || typeof value === "bigint") return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string") {
    if (value.length === 0) {
      return <span className="text-muted-foreground">{"\"\""}</span>
    }
    if (value.length > 120) {
      return <span className="whitespace-pre-wrap break-all text-xs leading-relaxed">{value}</span>
    }
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function searchableValue(value: unknown) {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.toLowerCase()
  if (typeof value === "number" || typeof value === "bigint") return value.toString().toLowerCase()
  if (typeof value === "boolean") return value ? "true" : "false"
  if (value instanceof Date) return value.toISOString().toLowerCase()
  try {
    return JSON.stringify(value).toLowerCase()
  } catch {
    return String(value).toLowerCase()
  }
}

const STEP_COLUMN_KEYS = [
  "main_step",
  "metro_steps",
  "metro_current_step",
  "metro_end_step",
  "custom_end_step",
  "inform_step",
] as const

const STEP_COLUMN_KEY_SET = new Set<string>(STEP_COLUMN_KEYS)

function normalizeStepValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

function parseMetroSteps(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((part) => normalizeStepValue(part))
      .filter((step): step is string => Boolean(step))
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => normalizeStepValue(part))
      .filter((step): step is string => Boolean(step))
  }
  const single = normalizeStepValue(value)
  return single ? [single] : []
}

function renderMetroStepFlow(rowData: Record<string, unknown>) {
  const mainStep = normalizeStepValue(rowData.main_step)
  const metroSteps = parseMetroSteps(rowData.metro_steps)
  const statusValue = normalizeStepValue(rowData.status)
  const metroCurrentStep = normalizeStepValue(rowData.metro_current_step)
  const metroEndStep = normalizeStepValue(rowData.metro_end_step)
  const customEndStep = normalizeStepValue(rowData.custom_end_step)
  const informStep = normalizeStepValue(rowData.inform_step)

  const highlightStep =
    statusValue === "MAIN_COMPLETE"
      ? mainStep ?? metroCurrentStep ?? null
      : metroCurrentStep ?? mainStep ?? null

  const endStep = customEndStep ?? metroEndStep ?? null

  const orderedSteps: string[] = []
  if (mainStep) orderedSteps.push(mainStep)
  if (metroSteps.length > 0) orderedSteps.push(...metroSteps)
  if (informStep) orderedSteps.push(informStep)
  if (endStep && !orderedSteps.includes(endStep)) orderedSteps.push(endStep)

  const seen = new Set<string>()
  const steps = orderedSteps.filter((step) => {
    if (seen.has(step)) {
      return false
    }
    seen.add(step)
    return true
  })

  if (steps.length === 0) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((step, index) => {
        const isHighlight = highlightStep ? step === highlightStep : false
        const isEnd = endStep ? step === endStep : false
        const pillClasses = cn(
          "rounded-full border px-2 py-0.5 text-xs font-medium leading-none",
          isHighlight
            ? "border-primary bg-blue-600 text-primary-foreground"
            : isEnd && !isHighlight
              ? "border-border bg-slate-800 text-muted-foreground"
              : "border-border bg-white text-foreground"
        )

        return (
          <div key={`${step}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <IconChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
            <span className={pillClasses}>{step}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────

type DataTableProps = {
  lineId: string
}

export function DataTable({ lineId }: DataTableProps) {
  const [tables, setTables] = React.useState<TableOption[]>([])
  const [selectedTable, setSelectedTable] = React.useState<string>("")
  const [columns, setColumns] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<Array<Record<string, unknown>>>([])
  const [limit, setLimit] = React.useState<number>(DEFAULT_LIMIT)
  const [appliedLimit, setAppliedLimit] = React.useState<number>(DEFAULT_LIMIT)
  const [filter, setFilter] = React.useState("")             // 🔸 전역 필터 텍스트
  const [sorting, setSorting] = React.useState<SortingState>([]) // 🔸 정렬 상태
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

  // ── 서버에서 테이블 목록 가져오기(기존 로직 유지) ─────────
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

  // ── 선택 테이블의 데이터 가져오기(기존 로직 유지) ─────────
  const fetchRows = React.useCallback(async () => {
    if (!selectedTable) {
      setColumns([]); setRows([]); setRowsError(null); setLastFetchedCount(0)
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
      setColumns([]); setRows([]); setLastFetchedCount(0)
    } finally {
      if (rowsRequestRef.current === requestId) setIsLoadingRows(false)
    }
  }, [limit, selectedTable, lineId])

  React.useEffect(() => { fetchTables() }, [fetchTables])
  React.useEffect(() => { fetchRows() }, [fetchRows])

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

  const handleUpdate = React.useCallback(
    async (
      recordId: string,
      updates: {
        comment?: string
        needtosend?: number
      }
    ) => {
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

  // ─────────────────────────────────────────────────────────
  // 🔸 TanStack: 동적 컬럼 정의
  // - 서버에서 받은 컬럼 배열을 기반으로 ColumnDef 자동 생성
  // - accessorFn으로 안전하게 값 접근
  // - 헤더 클릭 시 정렬
  // ─────────────────────────────────────────────────────────
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

  const columnDefs = React.useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const stepColumnsWithIndex = columns
      .map((key, index) => ({ key, index }))
      .filter(({ key }) => STEP_COLUMN_KEY_SET.has(key))

    const shouldCombineSteps =
      stepColumnsWithIndex.some(({ key }) => key === "main_step") ||
      stepColumnsWithIndex.some(({ key }) => key === "metro_steps")

    const baseColumnKeys = shouldCombineSteps
      ? columns.filter((key) => !STEP_COLUMN_KEY_SET.has(key))
      : [...columns]

    const makeColumnDef = (colKey: string): ColumnDef<Record<string, unknown>> => ({
      id: colKey,
      header: () => colKey,
      accessorFn: (row) => row[colKey],
      cell: (info) => {
        const meta = info.table.options.meta as DataTableMeta | undefined

        if (colKey === "comment") {
          const rowData = info.row.original as { [key: string]: unknown }
          const rawId = rowData?.id
          if (!meta || rawId === undefined || rawId === null) {
            return formatCellValue(info.getValue())
          }
          const recordId = String(rawId)
          const baseValueRaw = rowData?.comment
          const baseValue =
            typeof baseValueRaw === "string"
              ? baseValueRaw
              : baseValueRaw == null
                ? ""
                : String(baseValueRaw)
          const isEditing = Boolean(meta.commentEditing[recordId])
          const draftValue = meta.commentDrafts[recordId]
          const value = isEditing ? draftValue ?? baseValue : baseValue
          const isSaving = Boolean(meta.updatingCells[`${recordId}:comment`])
          const errorMessage = meta.updateErrors[`${recordId}:comment`]
          const indicator = meta.cellIndicators[`${recordId}:comment`]
          const indicatorStatus = indicator?.status

          const handleSave = async () => {
            const nextValue = draftValue ?? baseValue
            if (nextValue === baseValue) {
              meta.setCommentEditingState(recordId, false)
              meta.removeCommentDraftValue(recordId)
              return
            }
            const success = await meta.handleUpdate(recordId, { comment: nextValue })
            if (!success) {
              return
            }
            meta.setCommentEditingState(recordId, false)
          }

          const handleCancel = () => {
            meta.setCommentEditingState(recordId, false)
            meta.removeCommentDraftValue(recordId)
            meta.clearUpdateError(`${recordId}:comment`)
          }

          return (
            <div className="flex flex-col gap-1">
              {isEditing ? (
                <>
                  <textarea
                    value={value}
                    disabled={isSaving || !meta.selectedTable}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      meta.setCommentDraftValue(recordId, nextValue)
                      meta.clearUpdateError(`${recordId}:comment`)
                    }}
                    className="min-h-[3rem] resize-y rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                    aria-label="Edit comment"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        void handleSave()
                      }}
                      disabled={isSaving || !meta.selectedTable}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="whitespace-pre-wrap break-words text-sm">
                    {baseValue.length > 0 ? (
                      baseValue
                    ) : (
                      <span className="text-muted-foreground"></span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    onClick={() => {
                      meta.setCommentDraftValue(recordId, baseValue)
                      meta.setCommentEditingState(recordId, true)
                      meta.clearUpdateError(`${recordId}:comment`)
                    }}
                    disabled={!meta.selectedTable}
                  >
                    Edit
                  </Button>
                </>
              )}
              {errorMessage ? (
                <div className="text-xs text-destructive">{errorMessage}</div>
              ) : indicatorStatus === "saving" ? (
                <div className="text-xs text-muted-foreground">Saving…</div>
              ) : indicatorStatus === "saved" ? (
                <div className="text-xs text-emerald-600">✓</div>
              ) : null}
            </div>
          )
        }

        if (colKey === "needtosend") {
          const rowData = info.row.original as { [key: string]: unknown }
          const rawId = rowData?.id
          if (!meta || rawId === undefined || rawId === null) {
            return formatCellValue(info.getValue())
          }
          const recordId = String(rawId)
          const baseValueRaw = rowData?.needtosend
          const baseValue =
            typeof baseValueRaw === "number"
              ? baseValueRaw
              : typeof baseValueRaw === "string"
                ? Number.parseInt(baseValueRaw, 10) || 0
                : Number(baseValueRaw) || 0
          const draftValue = meta.needToSendDrafts[recordId]
          const nextValue = draftValue ?? baseValue
          const isChecked = Number(nextValue) === 1
          const isSaving = Boolean(meta.updatingCells[`${recordId}:needtosend`])
          const errorMessage = meta.updateErrors[`${recordId}:needtosend`]
          const indicator = meta.cellIndicators[`${recordId}:needtosend`]
          const indicatorStatus = indicator?.status

          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={async (checked) => {
                    const numericNext = checked ? 1 : 0
                    if (numericNext === baseValue) {
                      meta.removeNeedToSendDraftValue(recordId)
                      meta.clearUpdateError(`${recordId}:needtosend`)
                      return
                    }
                    meta.setNeedToSendDraftValue(recordId, numericNext)
                    meta.clearUpdateError(`${recordId}:needtosend`)
                    const success = await meta.handleUpdate(recordId, {
                      needtosend: numericNext,
                    })
                    if (!success) {
                      meta.removeNeedToSendDraftValue(recordId)
                    }
                  }}
                  disabled={isSaving || !meta.selectedTable}
                  aria-label="Toggle need to send"
                />
                <div className="text-xs text-muted-foreground flex flex-row items-center gap-1">
                  {isChecked ? "Yes" : "No"}
                  {errorMessage ? (
                    <div className="text-xs text-destructive">{errorMessage}</div>
                  ) : indicatorStatus === "saving" ? (
                    <div className="text-xs text-muted-foreground">...</div>
                  ) : indicatorStatus === "saved" ? (
                    <div className="text-xs text-emerald-600">✓</div>
                  ) : null}
                </div>
              </div>
            </div>
          )
        }

        return formatCellValue(info.getValue())
      },
      enableSorting: colKey !== "comment", // comment 정렬은 비활성화 (편집 필드)
    })

    const defs = baseColumnKeys.map((key) => makeColumnDef(key))

    if (shouldCombineSteps) {
      const insertionIndex = stepColumnsWithIndex.length
        ? Math.min(...stepColumnsWithIndex.map(({ index }) => index))
        : defs.length
      const headerLabel = stepColumnsWithIndex[0]?.key ?? "Step Flow"
      const stepColumnDef: ColumnDef<Record<string, unknown>> = {
        id: "metro_step_flow",
        header: () => headerLabel,
        accessorFn: (row) => row["main_step"] ?? row["metro_steps"] ?? null,
        cell: (info) => renderMetroStepFlow(info.row.original as Record<string, unknown>),
        enableSorting: false,
      }
      defs.splice(Math.min(Math.max(insertionIndex, 0), defs.length), 0, stepColumnDef)
    }

    return defs
  }, [columns])

  // ─────────────────────────────────────────────────────────
  // 🔸 TanStack: 전역 필터 함수
  // - 모든 컬럼의 값을 합쳐서 includes 검색 (기존 searchableValue 재사용)
  // ─────────────────────────────────────────────────────────
  const globalFilterFn = React.useCallback(
    (row: Row<Record<string, unknown>>, _columnId: string, filterValue: string) => {
      if (!filterValue) return true
      const lc = String(filterValue).toLowerCase()
      // 표시 중인 컬럼만 대상으로 검색
      return columns.some((key) => {
        const v = row.original?.[key]
        return searchableValue(v).includes(lc)
      })
    },
    [columns]
  )

  // ─────────────────────────────────────────────────────────
  // 🔸 TanStack Table 인스턴스 생성
  // - 정렬/필터/페이지네이션 row model 활성화
  // - 전역 필터 state 연결
  // ─────────────────────────────────────────────────────────
  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    meta: tableMeta,
    state: {
      sorting,
      globalFilter: filter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
  })

  const emptyStateColSpan = Math.max(table.getVisibleLeafColumns().length, 1)

  const totalLoaded = rows.length
  const hasNoRows = !isLoadingRows && rowsError === null && columns.length === 0

  return (
    <section className="flex flex-col gap-2 px-4 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <IconDatabase className="size-5" />
            데이터 테이블 · {lineId}
          </div>
          <p className="text-sm text-muted-foreground">
            {selectedTable
              ? `Loaded ${numberFormatter.format(totalLoaded)} rows (limit ${numberFormatter.format(
                  appliedLimit
                )})`
              : "Select a table to inspect its rows."}
          </p>
        </div>
      </div>

      {/* 🔸 전역 필터 입력 → TanStack table의 globalFilter에 직접 연결 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Filter rows…"
          value={filter}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
          className="sm:w-80"
          aria-label="Filter table rows"
        />

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Select
            value={selectedTable}
            onValueChange={(value) => setSelectedTable(value)}
            disabled={isLoadingTables || tables.length === 0}
          >
            <SelectTrigger id="table-selector" className="w-full sm:w-64" aria-label="Select database table">
              <SelectValue placeholder="Select a table" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.fullName} value={table.fullName}>
                  <div className="flex flex-col">
                    <span>{table.name}</span>
                    {table.schema ? (
                      <span className="text-xs text-muted-foreground">{table.schema}</span>
                    ) : null}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            min={1}
            max={MAX_LIMIT}
            value={limit}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10)
              if (!Number.isNaN(next)) setLimit(clampLimit(next))
            }}
            className="w-full sm:w-28"
            aria-label="Row limit"
          />

          <Button variant="outline" onClick={fetchRows} disabled={isLoadingRows || !selectedTable}>
            {isLoadingRows ? <IconLoader className="mr-2 size-4 animate-spin" /> : <IconReload className="mr-2 size-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {tableListError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <IconAlertCircle className="size-5 shrink-0" />
          <span>{tableListError}</span>
        </div>
      ) : null}

      {rowsError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <IconAlertCircle className="size-5 shrink-0" />
          <span>{rowsError}</span>
        </div>
      ) : null}

      {/* 🔸 높이 고정 + 세로/가로 스크롤 + 헤더 sticky */}
      <div className="h-[600px] overflow-auto rounded-lg border">
        <div className="min-w-max"> {/* 가로 스크롤 하단에 보이게 */}
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/40">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const sortDir = header.column.getIsSorted() as false | "asc" | "desc"
                    return (
                      <TableHead
                        key={header.id}
                        className="whitespace-nowrap"
                      >
                        {canSort ? (
                          <button
                            className="inline-flex items-center gap-1"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortDir === "asc" && <IconChevronUp className="size-4" />}
                            {sortDir === "desc" && <IconChevronDown className="size-4" />}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                        <span
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none"
                        />

                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {isLoadingRows ? (
                <TableRow>
                  <TableCell colSpan={emptyStateColSpan} className="h-24 text-center text-sm text-muted-foreground">
                    Loading rows…
                  </TableCell>
                </TableRow>
              ) : rowsError ? (
                <TableRow>
                  <TableCell colSpan={emptyStateColSpan} className="h-24 text-center text-sm text-destructive">
                    {rowsError}
                  </TableCell>
                </TableRow>
              ) : hasNoRows ? (
                <TableRow>
                  <TableCell colSpan={emptyStateColSpan} className="h-24 text-center text-sm text-muted-foreground">
                    No rows returned for the selected table.
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={emptyStateColSpan} className="h-24 text-center text-sm text-muted-foreground">
                    No rows match your filter.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground justify-end">
        <Badge variant="outline">{numberFormatter.format(lastFetchedCount)} fetched</Badge>
        <Badge variant="outline">Limit {numberFormatter.format(appliedLimit)}</Badge>
        <span>Updated {isLoadingRows ? "just now" : timeFormatter.format(new Date())}</span>
      </div>
    </section>
  )
}
