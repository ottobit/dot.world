# dot.world

A world of sentient dots!

Many `dot`s, each perceiving, deciding and reasoning on its own with a local
or remote model, in a world shaped by the news it reads from outside itself.
Dots never talk to each other — they influence one another only through the
marks they leave in a shared world state.

`dot` is the mascot of [ottobit.github.io/portfolio](https://ottobit.github.io/portfolio/);
the first sketch of this world lives at
[dot-world.html](https://ottobit.github.io/portfolio/dot-world.html).

**Status:** no simulation code yet. What exists is the coherence layer — the
schema, the glossary, and the five decisions the design rests on.

## Where to start

- [`AGENTS.md`](AGENTS.md) — how this repository is organised and how to work in it
- [`_system/wiki/index.md`](_system/wiki/index.md) — the wiki index
- [`_system/wiki/decisions/`](_system/wiki/decisions/) — why it is built this way,
  and what not to do

## Commands

```sh
npm install
npm test              # tests + wiki lint (warnings for staleness/orphans)
npm run lint:wiki     # wiki lint only
npm run typecheck     # tsc --noEmit
```

## Licence

MIT © Giuseppe Quartarone
