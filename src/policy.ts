export const HARD_MAX_DELAY = 60_000

export const DEFAULT_PROVIDER_IDS = ["nvidia"]
export const DEFAULT_ERROR_TYPES = ["provider.rate-limit", "provider.internal"]
export const DEFAULT_ERROR_MESSAGES: string[] = []

export type Options = {
  enabled?: boolean
  providerIDs?: string[]
  modelIDs?: string[]
  errorTypes?: string[]
  errorMessages?: string[]
  sessions?: string[]
  excludeSessions?: string[]
  initialDelay?: number
  maxDelay?: number
}

export type ResolvedOptions = {
  readonly enabled: boolean
  readonly providerIDs: ReadonlySet<string>
  readonly modelIDs: ReadonlySet<string> | undefined
  readonly modelFilterInvalid: boolean
  readonly errorTypes: ReadonlySet<string>
  readonly errorMessages: ReadonlySet<string>
  readonly sessions: ReadonlySet<string>
  readonly excludeSessions: ReadonlySet<string>
  readonly initialDelay: number
  readonly maxDelay: number
}

export type ProviderError = {
  readonly type: string
  readonly message: string
  readonly response?: { readonly body?: string }
}

export type ModelRef = {
  readonly providerID: string
  readonly id: string
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []

const finiteDelay = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined

export function resolveOptions(value: unknown): ResolvedOptions {
  const options = record(value)
  const providerIDs = options.providerIDs === undefined ? DEFAULT_PROVIDER_IDS : strings(options.providerIDs)
  const modelIDs = options.modelIDs === undefined ? undefined : strings(options.modelIDs)
  const errorTypes = options.errorTypes === undefined ? DEFAULT_ERROR_TYPES : strings(options.errorTypes)
  const errorMessages = options.errorMessages === undefined ? DEFAULT_ERROR_MESSAGES : strings(options.errorMessages)
  const sessions = strings(options.sessions)
  const excludeSessions = strings(options.excludeSessions)

  const maxDelay = Math.min(HARD_MAX_DELAY, finiteDelay(options.maxDelay) ?? HARD_MAX_DELAY)
  const requestedInitialDelay = finiteDelay(options.initialDelay) ?? 1_000
  const initialDelay = Math.min(maxDelay, requestedInitialDelay)

  return {
    enabled: options.enabled !== false,
    providerIDs: new Set(providerIDs.map((item) => item.toLowerCase())),
    modelIDs: modelIDs === undefined ? undefined : new Set(modelIDs),
    modelFilterInvalid: options.modelIDs !== undefined && !Array.isArray(options.modelIDs),
    errorTypes: new Set(errorTypes.map((item) => item.toLowerCase())),
    errorMessages: new Set(errorMessages),
    sessions: new Set(sessions),
    excludeSessions: new Set(excludeSessions),
    initialDelay,
    maxDelay,
  }
}

export function sessionMatches(sessionID: string, options: ResolvedOptions): boolean {
  if (options.excludeSessions.has(sessionID)) return false
  if (options.sessions.size > 0 && !options.sessions.has(sessionID)) return false
  return true
}

export function modelMatches(model: ModelRef, options: ResolvedOptions): boolean {
  if (!options.providerIDs.has(model.providerID.toLowerCase())) return false
  if (options.modelFilterInvalid) return false
  if (options.modelIDs !== undefined && options.modelIDs.size > 0 && !options.modelIDs.has(model.id)) return false
  return true
}

export function errorMatches(error: ProviderError, options: ResolvedOptions): boolean {
  if (options.errorTypes.size > 0 && !options.errorTypes.has(error.type.toLowerCase())) return false
  if (options.errorMessages.size === 0) return true

  const body = error.response?.body
  const haystack = [error.message, body].filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase())
  return [...options.errorMessages].some((pattern) => {
    const normalized = pattern.toLowerCase()
    return normalized === "*" || haystack.some((item) => item.includes(normalized))
  })
}

/** Delay after a failed physical attempt, with exponential growth and a hard one-minute ceiling. */
export function backoffDelay(failures: number, options: ResolvedOptions): number {
  if (options.initialDelay === 0 || options.maxDelay === 0) return 0
  const exponent = Math.max(0, Math.min(30, Math.floor(failures) - 1))
  return Math.min(options.maxDelay, options.initialDelay * 2 ** exponent)
}
