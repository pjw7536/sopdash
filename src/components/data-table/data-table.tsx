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

import {
  MAX_LIMIT,
  clampLimit,
  numberFormatter,
  timeFormatter,
} from "./constants"
import { createColumnDefs } from "./column-defs"
import { createGlobalFilterFn } from "./global-filter"
import { useDataTableState } from "./use-data-table"

type DataTableProps = {
  lineId: string
}

export function DataTable({ lineId }: DataTableProps) {
  const {
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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Filter rows…"
          value={filter}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
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
              {tables.map((tableOption) => (
                <SelectItem key={tableOption.fullName} value={tableOption.fullName}>
                  <div className="flex flex-col">
                    <span>{tableOption.name}</span>
                    {tableOption.schema ? (
                      <span className="text-xs text-muted-foreground">{tableOption.schema}</span>
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
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10)
              if (!Number.isNaN(next)) setLimit(clampLimit(next))
            }}
            className="w-full sm:w-28"
            aria-label="Row limit"
          />

          <Button variant="outline" onClick={() => void fetchRows()} disabled={isLoadingRows || !selectedTable}>
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
        <Badge variant="outline">Limit {numberFormatter.format(appliedLimit)}</Badge>
        <span>Updated {isLoadingRows ? "just now" : timeFormatter.format(new Date())}</span>
      </div>
    </section>
  )
}
