"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconDatabase,
  IconLoader,
  IconReload,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  dateFormatter,
  numberFormatter,
  timeFormatter,
  toDateInputValue,
} from "./constants"
import { createColumnDefs } from "./column-defs"
import { createGlobalFilterFn } from "./global-filter"
import { useDataTableState } from "./use-data-table"

type DataTableProps = {
  lineId: string
}

export function DataTable({ lineId }: DataTableProps) {
  const {
    selectedTable,
    columns,
    rows,
    since,
    setSince,
    appliedSince,
    filter,
    setFilter,
    sorting,
    setSorting,
    isLoadingRows,
    rowsError,
    lastFetchedCount,
    fetchRows,
    tableMeta,
  } = useDataTableState({ lineId })

  const columnDefs = React.useMemo(() => createColumnDefs(columns), [columns])
  const globalFilterFn = React.useMemo(() => createGlobalFilterFn(columns), [columns])

  // eslint-disable-next-line react-hooks/incompatible-library
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
  const sinceLabel = appliedSince
    ? dateFormatter.format(new Date(`${appliedSince}T00:00:00Z`))
    : "all time"
  const [lastUpdatedLabel, setLastUpdatedLabel] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (isLoadingRows) return
    setLastUpdatedLabel(timeFormatter.format(new Date()))
  }, [isLoadingRows])

  return (
    <section className="flex flex-col gap-2 px-4 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <IconDatabase className="size-5" />
            데이터 테이블 · {lineId}
          </div>
          <p className="text-sm text-muted-foreground">
            Loaded {numberFormatter.format(totalLoaded)} rows from {selectedTable} (since {sinceLabel}).
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Filter rows…"
          value={filter}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
          className="sm:w-80"
          aria-label="Filter table rows"
        />

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            type="date"
            max={toDateInputValue(new Date())}
            value={since}
            onChange={(event) => setSince(event.target.value)}
            className="w-full sm:w-40"
            aria-label="Since date"
          />

          <Button variant="outline" onClick={() => void fetchRows()} disabled={isLoadingRows}>
            {isLoadingRows ? <IconLoader className="mr-2 size-4 animate-spin" /> : <IconReload className="mr-2 size-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {rowsError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <IconAlertCircle className="size-5 shrink-0" />
          <span>{rowsError}</span>
        </div>
      ) : null}

      <div className="h-[600px] overflow-auto rounded-lg border">
        <div className="min-w-max">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/40">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort()
                    const sortDir = header.column.getIsSorted() as false | "asc" | "desc"
                    return (
                      <TableHead key={header.id} className="whitespace-nowrap">
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
                    No rows returned.
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
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 justify-end text-xs text-muted-foreground">
        <Badge variant="outline">{numberFormatter.format(lastFetchedCount)} fetched</Badge>
        <Badge variant="outline">
          Since {appliedSince ? dateFormatter.format(new Date(`${appliedSince}T00:00:00Z`)) : "all time"}
        </Badge>
        <span>Updated {isLoadingRows ? "just now" : lastUpdatedLabel ?? "just now"}</span>
      </div>
    </section>
  )
}
