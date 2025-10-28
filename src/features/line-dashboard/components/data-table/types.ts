import { z } from "zod"

export const tableDataSchema = z.object({
  table: z.string(),
  since: z.string().nullable(),
  rowCount: z.number(),
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
})

export type HandleUpdateFn = (
  recordId: string,
  updates: {
    comment?: string
    needtosend?: number
  }
) => Promise<boolean>

export type CellIndicator = {
  status: "saving" | "saved"
  visibleSince: number
}

export type IndicatorTimers = {
  savingDelay?: ReturnType<typeof setTimeout>
  transition?: ReturnType<typeof setTimeout>
  savedCleanup?: ReturnType<typeof setTimeout>
}

export type DataTableMeta = {
  commentDrafts: Record<string, string>
  commentEditing: Record<string, boolean>
  needToSendDrafts: Record<string, number>
  updatingCells: Record<string, boolean>
  updateErrors: Record<string, string>
  cellIndicators: Record<string, CellIndicator>
  clearUpdateError: (key: string) => void
  setCommentDraftValue: (recordId: string, value: string) => void
  removeCommentDraftValue: (recordId: string) => void
  setCommentEditingState: (recordId: string, editing: boolean) => void
  setNeedToSendDraftValue: (recordId: string, value: number) => void
  removeNeedToSendDraftValue: (recordId: string) => void
  handleUpdate: HandleUpdateFn
}
