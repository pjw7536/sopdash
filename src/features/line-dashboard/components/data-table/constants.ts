export const DEFAULT_TABLE = "drone_sop_v3"
export const DEFAULT_SINCE_DAYS = 3

const DAY_IN_MS = 86_400_000

export const toDateInputValue = (date: Date) => date.toISOString().split("T")[0]!

export const getDefaultSinceValue = () => {
  const now = new Date()
  const since = new Date(now.getTime() - DEFAULT_SINCE_DAYS * DAY_IN_MS)
  return toDateInputValue(since)
}

export const SAVING_DELAY_MS = 180
export const MIN_SAVING_VISIBLE_MS = 500
export const SAVED_VISIBLE_MS = 800

export const STEP_COLUMN_KEYS = [
  "main_step",
  "metro_steps",
  "metro_current_step",
  "metro_end_step",
  "custom_end_step",
  "inform_step",
] as const

export const STEP_COLUMN_KEY_SET = new Set<string>(STEP_COLUMN_KEYS)

export const numberFormatter = new Intl.NumberFormat()
export const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

export const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
