---
id: contracts/language-model
type: contract
title: What is a LanguageModel allowed to know, and what happens when it misbehaves?
covers: [src/models/types.ts, src/models/echo.ts, src/models/http.ts, src/policies/prompt.ts, src/policies/model.ts]
exports: [LanguageModel, ChatRequest, ChatResponse, createEchoModel, createOllamaModel, createOpenAICompatibleModel, buildPrompt, parseDecision, retryMessage, createModelPolicy, latencyPercentiles]
depends_on: [decisions/0004-two-layer-inference, contracts/decision-policy, concepts/deliberation-budget]
updated: 2026-09-05
---

# Contract — `LanguageModel`

**When to open this page.** Before adding a provider, before touching the
prompt, and before trusting a reply.

```ts
interface LanguageModel {
  readonly id: string;
  readonly supportsBatch: boolean;
  complete(request: ChatRequest, signal: AbortSignal): Promise<ChatResponse>;
}
```

**It knows an endpoint and nothing else.** No dots, no prompts, no decisions.
The core builds the prompt — decision
[`0004`](../decisions/0004-two-layer-inference.md) — because the moment two
transports word the same request differently, comparing them measures the
prompts rather than the models.

## The three implementations

| model | what it is for |
|---|---|
| `createEchoModel` | answers without a model, so the whole path runs offline |
| `createOllamaModel` | a model on the machine, `localhost:11434` |
| `createOpenAICompatibleModel` | OpenAI, LM Studio, llama.cpp, Groq, OpenRouter |

`EchoModel` is not a mock in the usual sense. It is how prompt building, JSON
parsing, validation, retry, fallback and the budget get tested at all: a real
model emits bad JSON when it feels like it, not when a test needs it, so
`replies` lets any failure be provoked on demand.

## What happens when a reply is wrong

Constrained output → validate → **one** retry with the failure fed back → fall
back to `ScriptedPolicy`. Nothing throws. A world that halts because a 3B model
emitted a trailing comma is not a world.

Failures are named rather than counted together: `not-json`, `not-an-object`,
`unknown-action`, `missing-topic`, `unsensed-topic`, `no-direction`. Every one
is counted and reported as a percentage of calls — *"12% invalid with model X"*
is a number worth seeing, and the only way to have it is to count it here.

The parser digs the first balanced object out of prose and fenced blocks,
because small models add both even when told not to, and refusing those throws
away good answers. It is not fooled by a brace inside a string.

**A topic the dot cannot sense is rejected.** Accepting it would let a model
invent pressure that is not in the world.

## A measured prompt bug, not a model bug

An echo run rejected **25% of replies** as follow-with-no-direction — a dot can
sense a topic while standing on its peak, where there is nowhere to follow it.
The prompt was offering `follow` regardless. It now sends `canDo`, and the
failure has its own name (`no-direction`) rather than being filed under
`unsensed-topic`, where it would have sent someone hunting a hallucination that
never happened. After the fix: **0% rejected, 0 retries, 0 fallbacks.**

## Not verified against a live endpoint

Neither HTTP transport has parsed a real response from this environment: the
egress proxy blocks outbound HTTP and no Ollama runs here. The shapes are the
documented ones and fixtures pin them. **Do not read the fixtures as proof they
work live.**

What *was* verified against a real failure: with no Ollama listening,
`--policy model --model ollama:llama3.2` produced 106 transport errors, 106
fallbacks, and a world that ran to completion.

## What NOT to do

- **Do not put prompt text in a transport.** See above.
- **Do not add a provider SDK** where the endpoint is OpenAI-compatible.
- **Do not let a parse failure throw.** Retry once, fall back, count it.
- **Do not hard-code a key.** `OPENAI_API_KEY` comes from the environment.

## See also

- [`concepts/deliberation-budget.md`](../concepts/deliberation-budget.md)
- [`recipes/add-a-model-provider.md`](../recipes/add-a-model-provider.md)
