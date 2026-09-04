---
id: decisions/0004-two-layer-inference
type: decision
title: Why is inference split into a transport layer and a decision layer?
depends_on: [glossary#languagemodel, glossary#policy, glossary#deliberation]
sources: [_knowledge/raw/plans/2026-09-04-initial-plan.md]
updated: 2026-09-04
---

# 0004 — Two layers: `LanguageModel` and `DecisionPolicy`

**When to open this page.** Before adding a provider, before putting prompt
text inside a provider, or before deleting `ScriptedPolicy`.

**Status:** accepted.

## Context

A single "provider" interface mixes two unrelated concerns: *how we talk to a
model* and *how a dot decides*. Merged, swapping a provider silently changes
behaviour, and the world cannot run without a model at all.

## Decision

```ts
// Layer 1 — transport. Knows an endpoint. Knows nothing about dots.
interface LanguageModel {
  readonly id: string;
  readonly supportsBatch: boolean;
  complete(req: ChatRequest, signal: AbortSignal): Promise<ChatResponse>;
}
// OllamaModel, OpenAICompatibleModel (OpenAI, LM Studio, llama.cpp, Groq,
// OpenRouter), AnthropicModel, EchoModel

// Layer 2 — decision. Percept in, action out.
interface DecisionPolicy {
  decide(reqs: DecisionRequest[], signal: AbortSignal): Promise<Decision[]>;
}
// ScriptedPolicy, ModelPolicy(LanguageModel), ReplayPolicy(runLog)
```

**The core builds the prompt, not the provider.** Swapping providers changes
cost and quality, never expected behaviour.

Each dot names a `modelRef` from a registry in config, so "one model per dot,
configurable independently of every other dot" stays true.

**Robustness is part of the contract:** output constrained to JSON matching
the action schema → validate → one retry with the error fed back → then fall
back to `ScriptedPolicy`. A malformed response must **never** stop the world.
Every failure is counted and surfaced: "12% invalid JSON with model X" is a
number worth seeing.

## Consequences

- The entire world develops and tests with no model running.
- Adding a provider is one file implementing `LanguageModel`, with no change
  to any dot.
- Small local models are usable: their failure mode degrades to scripted
  behaviour instead of a crash.

## What NOT to do

- **Do not put prompt text in a provider.** The moment two providers word the
  same prompt differently, comparing them measures the prompts, not the models.
- **Do not treat `ScriptedPolicy` as a test double.** It is the fallback when
  the deliberation budget is exhausted, the policy behind the public demo, and
  the reason the world runs offline. Removing it as "dead code" breaks all
  three at once, and none of them fail loudly.
- **Do not let a parse failure throw.** Retry once, then fall back, and record
  it. A world that stops because a 3B model emitted a trailing comma is not a
  world.
- **Do not add a provider SDK dependency** when the endpoint is
  OpenAI-compatible. `OpenAICompatibleModel` already covers most of them.

## See also

- [`0002`](0002-sync-ticks-async-reasoning.md) — when a model is actually called
- [`0005`](0005-enrich-news-once.md) — the other place a model is worth spending
