"use client"

import * as React from "react"

import { CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  const [showSuccessIndicator, setShowSuccessIndicator] = React.useState(false)
  const successDismissTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!isEditing) {
      setShowSuccessIndicator(false)
      return
    }

    if (indicatorStatus === "saving") {
      setShowSuccessIndicator(false)
      return
    }

    if (indicatorStatus === "saved") {
      setShowSuccessIndicator(true)
      if (successDismissTimerRef.current) {
        window.clearTimeout(successDismissTimerRef.current)
      }
      successDismissTimerRef.current = window.setTimeout(() => {
        meta.setCommentEditingState(recordId, false)
        meta.removeCommentDraftValue(recordId)
        meta.clearUpdateError(`${recordId}:comment`)
        setShowSuccessIndicator(false)
        successDismissTimerRef.current = null
      }, 800)
    }

    return () => {
      if (successDismissTimerRef.current) {
        window.clearTimeout(successDismissTimerRef.current)
        successDismissTimerRef.current = null
      }
    }
  }, [indicatorStatus, isEditing, meta, recordId])

  const handleOpen = () => {
    if (!meta.selectedTable) {
      return
    }
    meta.setCommentDraftValue(recordId, baseValue)
    meta.setCommentEditingState(recordId, true)
    meta.clearUpdateError(`${recordId}:comment`)
  }

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
  }

  const handleCancel = () => {
    if (successDismissTimerRef.current) {
      window.clearTimeout(successDismissTimerRef.current)
      successDismissTimerRef.current = null
    }
    setShowSuccessIndicator(false)
    meta.setCommentEditingState(recordId, false)
    meta.removeCommentDraftValue(recordId)
    meta.clearUpdateError(`${recordId}:comment`)
  }

  return (
    <div className="flex flex-col gap-1">
      <Dialog open={isEditing} onOpenChange={(open) => (!open ? handleCancel() : undefined)}>
        <button
          type="button"
          className="w-full rounded-md border border-transparent px-2 py-1 text-left text-sm transition hover:border-muted hover:bg-muted disabled:cursor-not-allowed"
          onClick={handleOpen}
          disabled={!meta.selectedTable}
          aria-label={baseValue.length > 0 ? "Edit comment" : "Add comment"}
        >
          <div className="whitespace-pre-wrap break-words text-left text-sm">
            {baseValue.length > 0 ? (
              baseValue
            ) : (
              <span className="text-muted-foreground">Add comment</span>
            )}
          </div>
        </button>
        <DialogContent className="gap-5">
          <DialogHeader>
            <DialogTitle>Edit comment</DialogTitle>
          </DialogHeader>
          <textarea
            value={value}
            disabled={isSaving || !meta.selectedTable}
            onChange={(event) => {
              const nextValue = event.target.value
              meta.setCommentDraftValue(recordId, nextValue)
              meta.clearUpdateError(`${recordId}:comment`)
            }}
            className="min-h-[6rem] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
            aria-label="Edit comment"
            autoFocus
          />
          {errorMessage ? (
            <div className="text-xs text-destructive">{errorMessage}</div>
          ) : null}
          <DialogFooter className="items-center">
            <div className="mr-auto flex min-h-4 items-center gap-1 text-xs">
              {indicatorStatus === "saving" ? (
                <span className="text-muted-foreground">Saving…</span>
              ) : showSuccessIndicator ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckIcon className="size-3.5" /> Saved
                </span>
              ) : null}
            </div>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
