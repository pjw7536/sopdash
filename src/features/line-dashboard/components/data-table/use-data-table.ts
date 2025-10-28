"use client"

import * as React from "react"
import type { SortingState } from "@tanstack/react-table"

import { DEFAULT_LIMIT, DEFAULT_TABLE } from "./constants"
import type { DataTableMeta, HandleUpdateFn, TableOption } from "./types"
import { tableDataSchema, tablesResponseSchema } from "./types"
import { useCellIndicators } from "./use-cell-indicators"

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

function deleteKeys<TValue>(record: Record<string, TValue>, keys: string[]) {
  if (keys.length === 0) return record
  let next: Record<string, TValue> | null = null
  keys.forEach((key) => {
    if (key in record) {
      if (next === null) next = { ...record }
      delete next[key]
    }
  })
  return next ?? record
}

function removeKey<TValue>(record: Record<string, TValue>, key: string) {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

function pickPreferredTable(options: TableOption[], previous: string) {
  if (options.length === 0) return ""

  const byFullName = options.find((option) => option.fullName === previous)
  if (byFullName) return byFullName.fullName

  const byName = options.find((option) => option.name === previous)
  if (byName) return byName.fullName

  const preferred =
    options.find((option) => option.fullName === DEFAULT_TABLE || option.name === DEFAULT_TABLE) ??
    options[0]

  return preferred.fullName
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
  const [isLoadingTables, setIsLoadingTables] = React.useState(false)
  const [isLoadingRows, setIsLoadingRows] = React.useState(false)
  const [tableListError, setTableListError] = React.useState<string | null>(null)
  const [rowsError, setRowsError] = React.useState<string | null>(null)
  const [lastFetchedCount, setLastFetchedCount] = React.useState(0)

  const tablesRequestRef = React.useRef(0)
  const rowsRequestRef = React.useRef(0)
  const { cellIndicators, begin, finalize } = useCellIndicators()

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

      setSelectedTable((previous) => {
        if (!previous) {
          return pickPreferredTable(nextTables, DEFAULT_TABLE)
        }
        return pickPreferredTable(nextTables, previous)
      })
    } catch (error) {
      if (tablesRequestRef.current !== requestId) return
      const message = error instanceof Error ? error.message : "Failed to load table list"
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
      if (lineId) params.set("lineId", lineId)

      const response = await fetch(`/api/tables?${params.toString()}`, { cache: "no-store" })
      let payload: unknown = {}

      try {
        payload = await response.json()
      } catch {
        payload = {}
      }

      if (!response.ok) {
        const message =
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : `Request failed with status ${response.status}`
        throw new Error(message)
      }

      const parsed = tableDataSchema.safeParse(payload)
      if (!parsed.success) throw new Error("Received unexpected data from server")
      if (rowsRequestRef.current !== requestId) return

      const { columns: fetchedColumns, rows: fetchedRows, rowCount, limit: applied, table } = parsed.data

      setColumns(fetchedColumns)
      setRows(fetchedRows)
      setLastFetchedCount(rowCount)
      setAppliedLimit(applied)
      setCommentDrafts({})
      setCommentEditing({})
      setNeedToSendDrafts({})

      if (table && table !== selectedTable) {
        setSelectedTable(table)
      }
    } catch (error) {
      if (rowsRequestRef.current !== requestId) return
      const message = error instanceof Error ? error.message : "Failed to load table rows"
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
    setUpdateErrors((prev) => removeKey(prev, key))
  }, [])

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

      begin(cellKeys)

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

        let payload: unknown = {}
        try {
          payload = await response.json()
        } catch {
          payload = {}
        }

        if (!response.ok) {
          const message =
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
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
          setCommentDrafts((prev) => removeKey(prev, recordId))
          setCommentEditing((prev) => removeKey(prev, recordId))
        }

        if ("needtosend" in updates) {
          setNeedToSendDrafts((prev) => removeKey(prev, recordId))
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
          return deleteKeys(prev, cellKeys)
        })
        finalize(cellKeys, updateSucceeded ? "success" : "error")
      }
    },
    [selectedTable, begin, finalize]
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
      return removeKey(prev, recordId)
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
    setCommentDrafts((prev) => removeKey(prev, recordId))
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
    setNeedToSendDrafts((prev) => removeKey(prev, recordId))
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
