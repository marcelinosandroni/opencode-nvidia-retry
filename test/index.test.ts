import assert from "node:assert/strict"
import { describe, it } from "node:test"
import plugin from "../src/index.ts"
import {
  HARD_MAX_DELAY,
  backoffDelay,
  errorMatches,
  modelMatches,
  resolveOptions,
  sessionMatches,
} from "../src/policy.ts"

type RetryDecision = { retry: false } | { retry: true; delay: number }

type RetryEvent = {
  sessionID: string
  agent: string
  model: { providerID: string; id: string }
  error: { type: string; message: string; response?: { body?: string } }
  attempt: number
  decision: RetryDecision
}

type ExecutionEvent = {
  type: "session.execution.started" | "session.execution.succeeded" | "session.execution.failed" | "session.execution.interrupted" | "session.deleted"
  data: { sessionID: string; error?: { type: string; message: string } }
}

type PromptCall = {
  sessionID: string
  id?: string
  text: string
  delivery?: "steer" | "queue"
}

class EventQueue<T> implements AsyncIterable<T> {
  private readonly values: T[] = []
  private readonly waiting: Array<(result: IteratorResult<T>) => void> = []
  private closed = false

  push(value: T) {
    const resolve = this.waiting.shift()
    if (resolve) resolve({ done: false, value })
    else this.values.push(value)
  }

  close() {
    this.closed = true
    while (this.waiting.length > 0) this.waiting.shift()?.({ done: true, value: undefined })
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: async () => {
        const value = this.values.shift()
        if (value !== undefined) return { done: false, value }
        if (this.closed) return { done: true, value: undefined }
        return new Promise<IteratorResult<T>>((resolve) => this.waiting.push(resolve))
      },
    }
  }
}

async function setup(options: Record<string, unknown> = {}) {
  let retry: ((event: RetryEvent) => void | Promise<void>) | undefined
  let registered = false
  let subscribed = false
  const events = new EventQueue<ExecutionEvent>()
  const prompts: PromptCall[] = []
  let resolvePrompt: ((call: PromptCall) => void) | undefined
  const prompted = new Promise<PromptCall>((resolve) => {
    resolvePrompt = resolve
  })

  const cleanup = await plugin.setup({
    options,
    session: {
      hook: async (name: string, callback: (event: RetryEvent) => void | Promise<void>) => {
        assert.equal(name, "retry")
        registered = true
        retry = callback
        return { dispose: async () => undefined }
      },
      get: async () => ({
        id: "ses_example",
        model: { providerID: "nvidia", id: "nvidia/example" },
      }),
      context: async () => [
        {
          id: "msg_user",
          type: "user",
          text: "Continue the task",
        },
      ],
      prompt: async (input: PromptCall) => {
        prompts.push(input)
        resolvePrompt?.(input)
        return { id: input.id ?? "msg_new" }
      },
    },
    event: {
      subscribe: ({ signal }: { signal?: AbortSignal }) => {
        subscribed = true
        signal?.addEventListener("abort", () => events.close(), { once: true })
        return events
      },
    },
  } as never)

  return {
    registered: () => registered,
    subscribed: () => subscribed,
    events,
    prompts,
    prompted,
    retry: async (event: RetryEvent) => {
      assert.ok(retry)
      await retry(event)
      return event
    },
    cleanup: async () => {
      events.close()
      await cleanup?.()
    },
  }
}

const retryEvent = (overrides: Partial<RetryEvent> = {}): RetryEvent => ({
  sessionID: "ses_example",
  agent: "build",
  model: { providerID: "nvidia", id: "nvidia/example" },
  error: { type: "provider.internal", message: "The provider had a problem" },
  attempt: 2,
  decision: { retry: false },
  ...overrides,
})

describe("retry policy", () => {
  it("uses NVIDIA and the reported provider message by default", () => {
    const options = resolveOptions({})

    assert.equal(options.enabled, true)
    assert.equal(modelMatches({ providerID: "nvidia", id: "any" }, options), true)
    assert.equal(modelMatches({ providerID: "openai", id: "any" }, options), false)
    assert.equal(
      errorMatches({ type: "provider.internal", message: "The provider had a problem" }, options),
      true,
    )
    assert.equal(errorMatches({ type: "provider.internal", message: "another error" }, options), false)
  })

  it("supports custom provider, model, error type, and message filters", () => {
    const options = resolveOptions({
      providerIDs: ["NVIDIA"],
      modelIDs: ["nemotron/test"],
      errorTypes: ["provider.internal"],
      errorMessages: ["temporary capacity"],
    })

    assert.equal(modelMatches({ providerID: "nvidia", id: "nemotron/test" }, options), true)
    assert.equal(modelMatches({ providerID: "nvidia", id: "other" }, options), false)
    assert.equal(
      errorMatches({ type: "provider.internal", message: "Temporary capacity exhausted" }, options),
      true,
    )
    assert.equal(
      errorMatches({ type: "provider.transport", message: "Temporary capacity exhausted" }, options),
      false,
    )
  })

  it("supports session inclusion and exclusion", () => {
    const options = resolveOptions({ sessions: ["ses_allowed"], excludeSessions: ["ses_blocked"] })

    assert.equal(sessionMatches("ses_allowed", options), true)
    assert.equal(sessionMatches("ses_other", options), false)
    assert.equal(sessionMatches("ses_blocked", options), false)
  })

  it("uses exponential backoff and caps the delay at one minute", () => {
    const options = resolveOptions({ initialDelay: 1_000, maxDelay: 120_000 })

    assert.equal(backoffDelay(1, options), 1_000)
    assert.equal(backoffDelay(2, options), 2_000)
    assert.equal(backoffDelay(3, options), 4_000)
    assert.equal(backoffDelay(20, options), HARD_MAX_DELAY)
    assert.equal(options.maxDelay, HARD_MAX_DELAY)
  })
})

describe("opencode.nvidia-retry", () => {
  it("can be disabled without registering hooks or subscriptions", async () => {
    const harness = await setup({ enabled: false })

    assert.equal(harness.registered(), false)
    assert.equal(harness.subscribed(), false)
    await harness.cleanup()
  })

  it("registers the retry hook", async () => {
    const harness = await setup()

    assert.equal(harness.registered(), true)
    assert.equal(harness.subscribed(), true)
    await harness.cleanup()
  })

  it("makes a matching provider failure retryable", async () => {
    const harness = await setup()

    const event = await harness.retry(retryEvent())

    assert.deepEqual(event.decision, { retry: true, delay: 1_000 })
    await harness.cleanup()
  })

  it("grows the delay between matching failures", async () => {
    const harness = await setup()

    const first = await harness.retry(retryEvent())
    const second = await harness.retry(retryEvent({ attempt: 3 }))

    assert.deepEqual(first.decision, { retry: true, delay: 1_000 })
    assert.deepEqual(second.decision, { retry: true, delay: 2_000 })
    await harness.cleanup()
  })

  it("ignores failures from another provider", async () => {
    const harness = await setup()

    const event = await harness.retry(
      retryEvent({
        model: { providerID: "openai", id: "gpt-test" },
      }),
    )

    assert.deepEqual(event.decision, { retry: false })
    await harness.cleanup()
  })

  it("ignores unrelated provider errors", async () => {
    const harness = await setup()

    const event = await harness.retry(
      retryEvent({
        error: { type: "provider.internal", message: "A different failure" },
      }),
    )

    assert.deepEqual(event.decision, { retry: false })
    await harness.cleanup()
  })

  it("resumes the same durable user message after a terminal failure", async () => {
    const harness = await setup({ initialDelay: 1, maxDelay: 1 })

    harness.events.push({
      type: "session.execution.failed",
      data: {
        sessionID: "ses_example",
        error: { type: "provider.internal", message: "The provider had a problem" },
      },
    })

    const call = await harness.prompted

    assert.deepEqual(call, {
      sessionID: "ses_example",
      id: "msg_user",
      text: "Continue the task",
      delivery: "steer",
    })
    await harness.cleanup()
  })

  it("cancels a pending resume when the user interrupts the session", async () => {
    const harness = await setup({ initialDelay: 20, maxDelay: 20 })

    harness.events.push({
      type: "session.execution.failed",
      data: {
        sessionID: "ses_example",
        error: { type: "provider.internal", message: "The provider had a problem" },
      },
    })
    harness.events.push({
      type: "session.execution.interrupted",
      data: { sessionID: "ses_example" },
    })

    await new Promise((resolve) => setTimeout(resolve, 50))

    assert.equal(harness.prompts.length, 0)
    await harness.cleanup()
  })

  it("does not resume unrelated terminal failures", async () => {
    const harness = await setup({ initialDelay: 1, maxDelay: 1 })

    harness.events.push({
      type: "session.execution.failed",
      data: {
        sessionID: "ses_example",
        error: { type: "provider.internal", message: "A different failure" },
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    assert.equal(harness.prompts.length, 0)
    await harness.cleanup()
  })
})
