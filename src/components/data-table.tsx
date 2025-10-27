"use client"

import * as React from "react"
import {
  IconAlertCircle,
  IconDatabase,
  IconLoader,
  IconReload,
  IconChevronUp,
  IconChevronDown,
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

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

// ─────────────────────────────────────────────────────────

export function DataTable() {
  const [tables, setTables] = React.useState<TableOption[]>([])
  const [selectedTable, setSelectedTable] = React.useState<string>("")
  const [columns, setColumns] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<Array<Record<string, unknown>>>([])
  const [limit, setLimit] = React.useState<number>(DEFAULT_LIMIT)
  const [appliedLimit, setAppliedLimit] = React.useState<number>(DEFAULT_LIMIT)
  const [filter, setFilter] = React.useState("")             // 🔸 전역 필터 텍스트
  const [sorting, setSorting] = React.useState<SortingState>([]) // 🔸 정렬 상태

  const [isLoadingTables, setIsLoadingTables] = React.useState(false)
  const [isLoadingRows, setIsLoadingRows] = React.useState(false)
  const [tableListError, setTableListError] = React.useState<string | null>(null)
  const [rowsError, setRowsError] = React.useState<string | null>(null)
  const [lastFetchedCount, setLastFetchedCount] = React.useState(0)

  const tablesRequestRef = React.useRef(0)
  const rowsRequestRef = React.useRef(0)

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
  }, [limit, selectedTable])

  React.useEffect(() => { fetchTables() }, [fetchTables])
  React.useEffect(() => { fetchRows() }, [fetchRows])

  // ─────────────────────────────────────────────────────────
  // 🔸 TanStack: 동적 컬럼 정의
  // - 서버에서 받은 컬럼 배열을 기반으로 ColumnDef 자동 생성
  // - accessorFn으로 안전하게 값 접근
  // - 헤더 클릭 시 정렬
  // ─────────────────────────────────────────────────────────
  const columnDefs = React.useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    return columns.map((colKey) => ({
      id: colKey,
      header: () => colKey,
      accessorFn: (row) => row[colKey],
      cell: (info) => formatCellValue(info.getValue()),
      enableSorting: true,
    }))
  }, [columns])

  // ─────────────────────────────────────────────────────────
  // 🔸 TanStack: 전역 필터 함수
  // - 모든 컬럼의 값을 합쳐서 includes 검색 (기존 searchableValue 재사용)
  // ─────────────────────────────────────────────────────────
  const globalFilterFn = React.useCallback(
    (row: any, _columnId: string, filterValue: string) => {
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

  const totalLoaded = rows.length
  const filteredCount = table.getRowModel().rows.length
  const hasNoRows = !isLoadingRows && rowsError === null && columns.length === 0

  return (
    <section className="flex flex-col gap-2 px-4 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <IconDatabase className="size-5" />
            데이터 테이블
            <p className="ml-3 text-sm text-muted-foreground">
            {selectedTable
              ? `Loaded ${numberFormatter.format(totalLoaded)} rows (limit ${numberFormatter.format(
                  appliedLimit         )})`
              : "Select a table to display its rows."}
          </p>
          </div>
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
                  <TableCell colSpan={columns.length || 1} className="h-24 text-center text-sm text-muted-foreground">
                    Loading rows…
                  </TableCell>
                </TableRow>
              ) : rowsError ? (
                <TableRow>
                  <TableCell colSpan={columns.length || 1} className="h-24 text-center text-sm text-destructive">
                    {rowsError}
                  </TableCell>
                </TableRow>
              ) : hasNoRows ? (
                <TableRow>
                  <TableCell colSpan={columns.length || 1} className="h-24 text-center text-sm text-muted-foreground">
                    No rows returned for the selected table.
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length || 1} className="h-24 text-center text-sm text-muted-foreground">
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
