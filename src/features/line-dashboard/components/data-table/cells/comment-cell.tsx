"use client"

import { Button } from "@/components/ui/button"

import type { DataTableMeta } from "../types"

type CommentCellProps = {
  meta: DataTableMeta
  recordId: string
  baseValue: string
}

export function CommentCell({ meta, recordId, baseValue }: CommentCellProps) {
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
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="whitespace-pre-wrap break-words text-sm">
            {baseValue.length > 0 ? baseValue : <span className="text-muted-foreground"></span>}
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
