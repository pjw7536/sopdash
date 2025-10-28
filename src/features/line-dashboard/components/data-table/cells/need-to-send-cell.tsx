"use client"

import { Checkbox } from "@/components/ui/checkbox"

import type { DataTableMeta } from "../types"

type NeedToSendCellProps = {
  meta: DataTableMeta
  recordId: string
  baseValue: number
}

export function NeedToSendCell({ meta, recordId, baseValue }: NeedToSendCellProps) {
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
          disabled={isSaving}
          aria-label="Toggle need to send"
        />
        <div className="flex flex-row items-center gap-1 text-xs text-muted-foreground">
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
