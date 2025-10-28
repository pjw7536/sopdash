import { IconChevronRight } from "@tabler/icons-react"

import { cn } from "@/lib/utils"

import { STEP_COLUMN_KEY_SET } from "./constants"

function formatShortDateTime(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${month}/${day} ${hours}:${minutes}`
}

function tryParseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    const looksLikeDateTime = /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(trimmed)
    const looksLikeDateOnly = /\d{4}-\d{2}-\d{2}$/.test(trimmed)
    if (!looksLikeDateTime && !looksLikeDateOnly) return null
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

export function formatCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">NULL</span>
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE"
  if (typeof value === "number" || typeof value === "bigint") return value.toString()
  const parsedDate = tryParseDate(value)
  if (parsedDate) return formatShortDateTime(parsedDate)
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

export function searchableValue(value: unknown) {
  if (value === null || value === undefined) return ""
  const parsedDate = tryParseDate(value)
  if (parsedDate) {
    const formatted = formatShortDateTime(parsedDate)
    return `${formatted} ${parsedDate.toISOString()}`.toLowerCase()
  }
  if (typeof value === "string") return value.toLowerCase()
  if (typeof value === "number" || typeof value === "bigint") return value.toString().toLowerCase()
  if (typeof value === "boolean") return value ? "true" : "false"
  try {
    return JSON.stringify(value).toLowerCase()
  } catch {
    return String(value).toLowerCase()
  }
}

export function normalizeStepValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

export function parseMetroSteps(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((part) => normalizeStepValue(part))
      .filter((step): step is string => Boolean(step))
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => normalizeStepValue(part))
      .filter((step): step is string => Boolean(step))
  }
  const single = normalizeStepValue(value)
  return single ? [single] : []
}

export function renderMetroStepFlow(rowData: Record<string, unknown>) {
  const mainStep = normalizeStepValue(rowData.main_step)
  const metroSteps = parseMetroSteps(rowData.metro_steps)
  const statusValue = normalizeStepValue(rowData.status)
  const metroCurrentStep = normalizeStepValue(rowData.metro_current_step)
  const metroEndStep = normalizeStepValue(rowData.metro_end_step)
  const customEndStep = normalizeStepValue(rowData.custom_end_step)
  const informStep = normalizeStepValue(rowData.inform_step)

  const highlightStep =
    statusValue === "MAIN_COMPLETE"
      ? mainStep ?? metroCurrentStep ?? null
      : metroCurrentStep ?? mainStep ?? null

  const endStep = customEndStep ?? metroEndStep ?? null

  const orderedSteps: string[] = []
  if (mainStep) orderedSteps.push(mainStep)
  if (metroSteps.length > 0) orderedSteps.push(...metroSteps)
  if (informStep) orderedSteps.push(informStep)
  if (endStep && !orderedSteps.includes(endStep)) orderedSteps.push(endStep)

  const seen = new Set<string>()
  const steps = orderedSteps.filter((step) => {
    if (seen.has(step)) {
      return false
    }
    seen.add(step)
    return true
  })

  if (steps.length === 0) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((step, index) => {
        const isHighlight = highlightStep ? step === highlightStep : false
        const isEnd = endStep ? step === endStep : false
        const pillClasses = cn(
          "rounded-full border px-2 py-0.5 text-xs font-medium leading-none",
          isHighlight
            ? "border-primary bg-blue-600 text-primary-foreground"
            : isEnd && !isHighlight
              ? "border-border bg-slate-800 text-muted-foreground"
              : "border-border bg-white text-foreground"
        )

        return (
          <div key={`${step}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <IconChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
            <span className={pillClasses}>{step}</span>
          </div>
        )
      })}
    </div>
  )
}

export function shouldCombineStepColumns(columns: string[]) {
  return columns.some((key) => STEP_COLUMN_KEY_SET.has(key) && (key === "main_step" || key === "metro_steps"))
}
