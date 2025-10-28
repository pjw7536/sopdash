"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

  const renderDialogStatusMessage = () => {
    if (errorMessage) {
      return <div className="text-xs text-destructive">{errorMessage}</div>
    }
    if (indicatorStatus === "saving") {
      return <div className="text-xs text-muted-foreground">Saving…</div>
    }
    if (indicatorStatus === "saved" && showSuccessIndicator) {
      return <div className="text-xs text-emerald-600">Saved</div>
    }
    return null
  }

  return (
    <div className="flex flex-col gap-1">
      <Dialog
        open={isEditing}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            meta.setCommentDraftValue(recordId, baseValue)
            meta.setCommentEditingState(recordId, true)
          } else {
            meta.setCommentEditingState(recordId, false)
            meta.removeCommentDraftValue(recordId)
          }
          meta.clearUpdateError(`${recordId}:comment`)
        }}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            className="whitespace-pre-wrap break-words rounded-md border border-transparent px-2 py-1 text-left text-sm transition-colors hover:border-border hover:bg-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {baseValue.length > 0 ? (
              baseValue
            ) : (
              <span className="text-muted-foreground">Tap to add a comment</span>
            )}
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit comment</DialogTitle>
          </DialogHeader>
          <textarea
            value={value}
            disabled={isSaving}
            onChange={(event) => {
              const nextValue = event.target.value
              meta.setCommentDraftValue(recordId, nextValue)
              meta.clearUpdateError(`${recordId}:comment`)
            }}
            className="min-h-[6rem] resize-y rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
            aria-label="Edit comment"
            autoFocus
          />
          {renderDialogStatusMessage()}
          <DialogFooter>
            <Button
              onClick={() => {
                void handleSave()
              }}
              disabled={isSaving}
            >
              Save
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Intentionally no inline status indicator. Status is shown within the dialog. */}
    </div>
  )
}
