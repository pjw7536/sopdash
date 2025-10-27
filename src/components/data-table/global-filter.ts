import type { Row } from "@tanstack/react-table"

import { searchableValue } from "./utils"

export const createGlobalFilterFn = (columns: string[]) =>
  (row: Row<Record<string, unknown>>, _columnId: string, filterValue: string) => {
    if (!filterValue) return true
    const lc = String(filterValue).toLowerCase()
    return columns.some((key) => {
      const value = row.original?.[key]
      return searchableValue(value).includes(lc)
    })
  }
