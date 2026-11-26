import { Plugin } from "@opencode/plugin"
import {
  backoffDelay,
  errorMatches,
  modelMatches,
  resolveOptions,
  sessionMatches,
  type ModelRef,
  type ProviderError,
  type ResolvedOptions,
} from "./policy.js"

type Candidate = {
  readonly providerID: string
  readonly modelID: string
  readonly errorType: string
  readonly errorMessage: string
}

type SessionState = {
  failures: number
  candidate?: Candidate
  timer?: ReturnType<typeof setTimeout>
}

type UserMessage = {
  readonly id: string
  readonly text: string
}

const log = (level: "info" | "warn" | "error", message: string, details: Record<string, unknown> = {}) => {
  const line = `[opencode.nvidia-retry] ${message}`
  if (level === "error") console.error(line, details)
  else if (level === "warn") console.warn(line, details)
  else console.info(line, details)
}

/**
 * Retry NVIDIA provider failures for as long as the session remains eligible.
 *
 * OpenCode's public retry hook controls retries inside one model turn, but its built-in
 * attempt budget is finite. When that budget is exhausted, this plugin listens for the
 * public `session.execution.failed` event and resumes the same user message by its durable
 * message ID. Reusing the ID reconciles the existing message instead of duplicating it.
 */
export default Plugin.define({
  id: "opencode.nvidia-retry",
  async setup(ctx) {
    const options: ResolvedOptions = resolveOptions(ctx.options)
    if (!options.enabled) {
      log("info", "disabled by configuration")
      return
    }
    log("info", "enabled", {
      providerIDs: [...options.providerIDs],
      modelIDs: options.modelIDs === undefined ? undefined : [...options.modelIDs],
      errorTypes: [...options.errorTypes],
      excludeErrorTypes: [...options.excludeErrorTypes],
      errorMessages: [...options.errorMessages],
      initialDelay: options.initialDelay,
      maxDelay: options.maxDelay,
    })

    const states = new Map<string, SessionState>()
    const controller = new AbortController()

    const stateFor = (sessionID: string) => {
      const existing = states.get(sessionID)
      if (existing) return existing
      const created: SessionState = { failures: 0 }
      states.set(sessionID, created)
      return created
    }

    const clearTimer = (state: SessionState) => {
      if (state.timer === undefined) return
      clearTimeout(state.timer)
      state.timer = undefined
    }

    const registration = await ctx.session.hook("retry", (event) => {
      if (!sessionMatches(event.sessionID, options)) return
      if (!modelMatches(event.model, options)) return
      if (!errorMatches(event.error, options)) return

      const state = stateFor(event.sessionID)
      clearTimer(state)
      state.failures++
      state.candidate = {
        providerID: event.model.providerID,
        modelID: event.model.id,
        errorType: event.error.type,
        errorMessage: event.error.message,
      }

      const delay = backoffDelay(state.failures, options)
      event.decision = { retry: true, delay }
      log("warn", "retrying provider failure", {
        sessionID: event.sessionID,
        providerID: event.model.providerID,
        modelID: event.model.id,
        failures: state.failures,
        delay,
      })
    })

    const resume = async (sessionID: string, prompt: UserMessage, state: SessionState) => {
      state.timer = undefined
      if (controller.signal.aborted) return

      try {
        await ctx.session.prompt({
          sessionID,
          id: prompt.id,
          text: prompt.text,
          delivery: "steer",
        })
        log("info", "provider failure resumed", {
          sessionID,
          messageID: prompt.id,
          failures: state.failures,
        })
      } catch (error) {
        if (controller.signal.aborted) return
        state.failures++
        const delay = backoffDelay(state.failures, options)
        state.timer = setTimeout(() => void resume(sessionID, prompt, state), delay)
        log("error", "could not resume provider failure", {
          sessionID,
          messageID: prompt.id,
          failures: state.failures,
          delay,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const handleFailure = async (sessionID: string, error: ProviderError) => {
      if (!sessionMatches(sessionID, options)) return

      const state = stateFor(sessionID)
      if (state.timer !== undefined) return

      const candidate = state.candidate
      // The candidate comes from the retry hook of the current turn, so it stays the most
      // reliable attribution of the model even when the terminal error has another shape.
      let model: ModelRef | undefined = candidate
        ? { providerID: candidate.providerID, id: candidate.modelID }
        : undefined
      if (!model) {
        try {
          const session = await ctx.session.get({ sessionID })
          if (session.model) model = session.model
        } catch (cause) {
          log("warn", "could not read the failed session model", {
            sessionID,
            error: cause instanceof Error ? cause.message : String(cause),
          })
        }
      }

      if (!model || !modelMatches(model, options)) return
      if (!errorMatches(error, options)) return

      let prompt: UserMessage | undefined
      try {
        const messages = await ctx.session.context({ sessionID })
        prompt = [...messages].reverse().find((message) => message.type === "user")
      } catch (cause) {
        log("error", "could not read the failed session prompt", {
          sessionID,
          error: cause instanceof Error ? cause.message : String(cause),
        })
        return
      }

      if (!prompt) {
        log("error", "no user message is available to resume", { sessionID })
        return
      }

      state.failures++
      state.candidate = {
        providerID: model.providerID,
        modelID: model.id,
        errorType: error.type,
        errorMessage: error.message,
      }
      const delay = backoffDelay(state.failures, options)
      state.timer = setTimeout(() => void resume(sessionID, { id: prompt.id, text: prompt.text }, state), delay)
      log("warn", "provider failure exhausted the turn retry budget; scheduling a resume", {
        sessionID,
        providerID: model.providerID,
        modelID: model.id,
        failures: state.failures,
        delay,
      })
    }

    const events = ctx.event.subscribe({
      types: [
        "session.execution.started",
        "session.execution.succeeded",
        "session.execution.failed",
        "session.execution.interrupted",
        "session.model.selected",
        "session.deleted",
      ],
      signal: controller.signal,
    })

    void (async () => {
      try {
        for await (const event of events) {
          if (controller.signal.aborted) break
          if (event.type === "session.execution.started") {
            const state = states.get(event.data.sessionID)
            if (state?.timer !== undefined) {
              clearTimer(state)
              state.failures = 0
              state.candidate = undefined
            }
            continue
          }
          if (event.type === "session.model.selected") {
            const state = states.get(event.data.sessionID)
            if (state) {
              clearTimer(state)
              state.failures = 0
              state.candidate = undefined
            }
            continue
          }
          if (event.type === "session.execution.succeeded" || event.type === "session.execution.interrupted") {
            const state = states.get(event.data.sessionID)
            if (state) clearTimer(state)
            states.delete(event.data.sessionID)
            continue
          }
          if (event.type === "session.deleted") {
            const state = states.get(event.data.sessionID)
            if (state) clearTimer(state)
            states.delete(event.data.sessionID)
            continue
          }
          await handleFailure(event.data.sessionID, event.data.error)
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          log("error", "event subscription stopped", {
            error: cause instanceof Error ? cause.message : String(cause),
          })
        }
      }
    })()

    return async () => {
      controller.abort()
      for (const state of states.values()) clearTimer(state)
      states.clear()
      await registration.dispose()
    }
  },
})
