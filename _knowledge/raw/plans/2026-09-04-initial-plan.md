# Dot World — piano di partenza

## Contesto

Dot World nasce da `dot`, la mascotte del portfolio (`ottobit/portfolio`,
`script.js`: `createMascotController`, ~1300 righe di fisica salto/lancio,
split/merge dei cloni, 6 feed di notizie pubblici). Lì c'è **un** dot che
reagisce. Qui vogliamo **tanti** dot che decidono, ognuno con la propria
inferenza (locale o remota), in un mondo che le notizie reali modificano.

Il diagramma pubblicato (`dot-world-diagram.svg`) descrive il ciclo
`Perceive → Reason → Decide → Act → next tick`, con `Act` che scrive nello
stato condiviso. È dichiarato "still taking shape". Questo piano lo prende
sul serio e **ne propone una modifica**, per un motivo preciso: preso alla
lettera, quel ciclo significa N dot × 1 chiamata a un modello per tick, che
non regge né come costo né come latenza. Non è un problema da ottimizzare
dopo: cambia dove va messo il confine tra codice e modello.

Non esiste ancora codice. Questo piano copre il primo milestone eseguibile.

## Blocco corrente

`ottobit/dot.world` non è raggiungibile da questa sessione:
- `add_repo` (access `push`) → *"you don't have access to ottobit/dot.world"*
- `git ls-remote` anonimo → richiesta di credenziali (quindi **non è pubblico**)

Serve una delle due, da parte dell'utente:
- rendere il repo pubblico, **oppure**
- concedere al GitHub App di Claude l'accesso a quel repo
  (claude.ai → Settings → Connectors → GitHub, oppure le impostazioni di
  accesso ai repository dell'app)

Il piano non dipende da questo. L'implementazione sì.

---

## 1. Stack: TypeScript, un solo pacchetto, engine isomorfo

**Decisione:** TypeScript, un unico pacchetto npm, engine puro che gira
**sia** in Node **sia** nel browser. Vite per il bundle web, Vitest per i
test, nessun framework UI (canvas 2D a mano, come il dot di oggi).

```
src/
  core/       engine puro — nessun I/O, nessun built-in Node
  policies/   come un dot decide (scripted / model / replay)
  models/     trasporto verso i modelli (ollama / openai-compatible / anthropic / echo)
  news/       adapter delle fonti + arricchimento
  node/       runner headless: config, loop, log JSONL
  web/        viewer canvas + pannello ispezione
```

**Perché non "solo web":** una pagina su `github.io` (HTTPS) non può
chiamare `http://localhost:11434` — mixed content, bloccato dal browser. E
una chiave API remota in una pagina statica è una chiave regalata. Quindi
l'inferenza vera **deve** poter stare fuori dal browser.

**Perché non "solo headless":** il valore di dot è che si guarda. Un
progetto di portfolio che si vede solo in un terminale è mezzo progetto.

**Perché l'engine isomorfo risolve entrambi:** il core non importa nulla di
Node, quindi la stessa simulazione gira in pagina con la policy
deterministica (demo live su GitHub Pages, zero backend) e in locale con i
modelli veri. In più: un run reale registrato su JSONL si **rigioca** nel
viewer web — così sulla pagina pubblica si vede un mondo mosso da modelli
veri senza esporre una sola chiave.

**Perché TS e non Python:** l'inferenza qui è una chiamata HTTP, non
training — nessuna libreria ML da inseguire. Un solo linguaggio per engine,
viewer e policy deterministica condivisa, e continuità con il codice di dot.

## 2. Esecuzione: tick sincrono per il mondo, ragionamento asincrono fuori dal tick

**Decisione:** il mondo avanza a **tick discreti e sincroni** (4 tick/s a
M1). Il ragionamento **non** sta dentro il tick.

Tre livelli, con budget crescente:

| livello | frequenza | costo | cosa fa |
|---|---|---|---|
| **reattivo** | ogni tick | codice puro | movimento, decadimento energia, collisioni, seguire un gradiente |
| **intenzione** | ogni K tick | codice puro | esegue il piano corrente (`vai verso la marca "ai"`, orizzonte 20-60 tick) |
| **deliberazione** | su evento | 1 chiamata al modello | sostituisce l'intenzione |

Un dot ha `mind: idle | thinking | committed`. Mentre pensa **continua ad
agire** sull'intenzione precedente: nessuno si blocca ad aspettare il
modello, e la latenza del modello non è latenza del mondo.

**Quando un dot delibera** (non ogni tick):
- un `Stimulus` con salienza alta per i suoi interessi (vedi §5)
- l'intenzione è fallita o è scaduta
- l'energia è sotto soglia
- timer di stallo: comunque almeno una volta ogni ~60s

**Come il costo resta limitato al crescere di N** — quattro leve, tutte a M2
tranne le prime due:
1. **Cap globale di concorrenza** (`DeliberationScheduler`): al massimo 4
   richieste in volo. I candidati si ordinano per salienza; chi non prende
   lo slot ricade sulla `ScriptedPolicy`. Il costo diventa funzione del
   tempo di parete, **non di N**. Questa è la leva che conta.
2. **Cadenze diverse per personalità**: un dot impulsivo delibera raramente
   e reagisce molto; uno contemplativo il contrario.
3. **Cache** su `hash(personality, percept quantizzato)` con TTL. Il percept
   è già discreto (cella di griglia, energia a bucket, id di topic invece
   del testo), quindi l'hit rate è alto per costruzione.
4. **Batching**: più dot sullo stesso provider in una richiesta sola
   (`supportsBatch`), N percept → array di N decisioni.

**Perché non un loop asincrono per dot:** perde il determinismo, e con esso
i test riproducibili, gli snapshot e — soprattutto — la registrazione e il
replay, che è ciò che rende possibile la demo pubblica. Con i tick, `step()`
è una funzione pura e il mondo è ispezionabile a ogni istante.

**Il determinismo sopravvive ai modelli** perché il log registra ogni
risposta del modello: in replay una `ReplayProvider` le riemette in ordine.
Un run reale è rigiocabile bit per bit.

## 3. Astrazione dell'inferenza: due strati, non uno

Un'unica interfaccia "provider" mescola due cose diverse (come si parla al
modello, e come si decide). Le separo:

```ts
// strato 1 — trasporto. Sa parlare a un endpoint, nient'altro.
interface LanguageModel {
  readonly id: string;
  readonly supportsBatch: boolean;
  complete(req: ChatRequest, signal: AbortSignal): Promise<ChatResponse>;
}
// implementazioni: OllamaModel, OpenAICompatibleModel (copre OpenAI,
// LM Studio, llama.cpp server, Groq, OpenRouter), AnthropicModel, EchoModel

// strato 2 — decisione. Percept in, Action out.
interface DecisionPolicy {
  decide(reqs: DecisionRequest[], signal: AbortSignal): Promise<Decision[]>;
}
// implementazioni: ScriptedPolicy (euristica pura, zero modelli),
// ModelPolicy(LanguageModel), ReplayPolicy(runLog)
```

Il prompt lo costruisce il **core**, non il provider — così cambiare
provider cambia il costo e la qualità, mai il comportamento atteso.

**Robustezza (non opzionale):** output vincolato a JSON conforme allo schema
delle azioni → validazione → un retry con l'errore in pasto al modello →
poi fallback su `ScriptedPolicy`. Una risposta malformata non deve **mai**
fermare il mondo. Ogni fallimento va contato e mostrato: "12% di JSON non
valido con il modello X" è un numero che vale la pena vedere.

`ScriptedPolicy` non è un ripiego per i test: è ciò che permette di
sviluppare l'intero mondo senza un modello acceso, ed è la policy della demo
pubblica.

Ogni dot in config nomina un `modelRef` da un registro — così "un modello
per dot, configurabile indipendentemente" del diagramma resta vero.

## 4. Stato del mondo: nessun dot ci scrive mai

**Decisione:** lo stato è di proprietà esclusiva dell'engine. `Act` non
scrive: **emette un intent**. L'engine applica gli intent a fine tick in
ordine deterministico. Le scritture concorrenti non si risolvono — non
esistono.

```ts
step(state, intents, rng) -> { state, events }   // funzione pura
```

Contenuto dello stato:
- `tick`, `seed`, `rngState`
- `dots[]` — id, pos, vel, colore, energia, umore, personalità, modelRef,
  intenzione corrente, memoria breve (ring buffer)
- `marks[]` — **il livello stigmergico**: `{pos, kind, topic, strength, createdTick}`,
  con `strength` che decade a ogni tick. È l'**unico** canale tra i dot.
- `grid` — aggregato per cella della forza delle marche per topic. È questo
  che i dot percepiscono (O(1)), non la lista delle marche.
- `stimuli[]` — le notizie entrate nel mondo (§5)
- `events[]` — cos'è successo in questo tick (log + viewer)

Regole di risoluzione (esplicite e noiose, quindi testabili):
- movimento: l'engine clampa velocità e bordi; due dot possono sovrapporsi
  (sono pallini, niente corpo rigido a M1)
- marca su cella che ha già una marca dello stesso `kind`+`topic`: **si
  rinforza** (`strength +=`), non si duplica. È la regola di accumulo
  stigmergico.
- ordinamento: `(priority, dotId)` — deterministico, mai per ordine di arrivo

**Cosa vede un dot (`Percept`)** — volutamente stretto:
- il proprio stato + esito dell'ultima azione
- vicinato: aggregati delle marche nelle 3×3 celle intorno + i K dot più
  vicini (id, colore, distanza, direzione — **non** i loro stati interni:
  niente telepatia)
- gli stimoli attivi nella sua cella
- la propria memoria recente

Il `Percept` **è** il prompt. Quindi la sua compattezza è un vincolo di
progetto, non una rifinitura: obiettivo < 400 token.

## 5. Notizie: arricchite una volta, condivise da tutti

**Fonti:** le stesse 6 già collaudate in `script.js` — Hacker News,
Hugging Face, pageviews Wikipedia, Open-Meteo, NASA APOD, commit GitHub.
Sono CORS-open, senza chiave, e già debuggate (rate limit, timeout, fallback
inclusi). Non se ne inventano di nuove.

**Frequenze:** HN 5min, GitHub 15min, HF 30min, meteo 30min, Wikipedia 6h,
APOD 24h. Cache su disco lato Node, ETag dove c'è.

**Come una notizia diventa qualcosa su cui ragionare** — è il passaggio
interessante:

```
RawItem --[Enricher]--> Stimulus { id, topics[], valence, intensity } --> World
```

`Enricher` ha due implementazioni:
- `KeywordEnricher` — deterministico: lessico di topic (`ai`, `space`,
  `weather`, `conflict`, `money`, `code`, `nature`…), valenza da una piccola
  lista di parole. Gratis, istantaneo, gira anche nel browser. **Default a M1.**
- `ModelEnricher` — una chiamata al modello **per lotto di items** (8 alla
  volta), non per dot. È il posto giusto dove spendere una chiamata: le
  notizie arrivano ~10 ogni 5 minuti e servono a tutti. Costo ammortizzato ≈ 0.

**Uno stimolo entra nel mondo come meteo**, non come messaggio: atterra in
una regione con un'intensità che si diffonde e decade. Un dot percepisce
*pressione tematica* nella propria cella — non legge un titolo, sente che
"da quelle parti c'è tanto `ai`".

Ogni dot ha `interests: Record<topic, weight>`. La salienza di uno stimolo è
`dot(interests, stimulus.topics) * intensity` — **ed è esattamente il
trigger di deliberazione del §2**. I due pezzi sono lo stesso pezzo.

## 6. Proposta di modifica al diagramma

Il diagramma attuale è onesto ma dice tre cose che il progetto non farà:

1. **Reason/Decide escono dal ciclo.** Il ciclo di tick è
   `Perceive → Act`. `Reason → Decide` è un ramo asincrono che, quando
   torna, sostituisce l'*intenzione* che `Act` sta già eseguendo.
2. **`Act` non scrive nello stato: emette un intent**, e il mondo lo
   applica. Cambia chi possiede lo stato — che è la ragione per cui non ci
   sono conflitti.
3. **Le notizie non entrano in `Perceive`**: passano da `Enrich → Stimulus →
   World`. È il *mondo* a essere influenzato dalle notizie; il dot percepisce
   il mondo. Un livello in meno di cui il dot deve sapere.

In più il diagramma va reso esplicito sul livello **Marks**: è l'unico
canale tra dot, e oggi non compare.

*(Modifica dello SVG sul portfolio: fuori scope di questo piano — repo
diverso. Da fare quando il codice conferma il disegno.)*

## 7. Primo milestone eseguibile — "il mondo respira"

**Cosa si guarda funzionare:**
- 12 dot, griglia 64×36, 4 tick/s
- 5 azioni soltanto: `move(dir)`, `mark(topic)`, `follow(topic)`, `rest`,
  `say(testo ≤ 60 char)`
- policy: `ScriptedPolicy` per tutti; `--policy=model --model=ollama:llama3.2`
  ne passa una frazione configurabile al ragionamento vero
- notizie: 2 fonti (Hacker News + trending Wikipedia) + `KeywordEnricher`
- a schermo: dot che si muovono, marche colorate per topic che sbiadiscono,
  bolle di dialogo quando un dot fa `say`
- pannello laterale: tick, deliberazioni in volo, chiamate al modello/min,
  hit rate della cache, stima di costo
- **click su un dot → ispettore**: il suo percept esatto, il prompt inviato,
  la risposta grezza, la decisione. È questo che trasforma il giocattolo in
  un pezzo di portfolio: si vede *perché* un dot ha fatto quella cosa.
- `--replay run.jsonl` rigioca un run; lo stesso file si carica nel viewer web

**File principali da creare:**
`src/core/{state,step,percept,intents,grid,rng}.ts`,
`src/policies/{scripted,model,replay}.ts`,
`src/models/{ollama,openai-compatible,echo}.ts`,
`src/news/{sources,enricher,poller}.ts`,
`src/node/run.ts`, `src/web/{main,render,inspector}.ts`,
più `CLAUDE.md`, `README.md`, config Vite/Vitest, workflow GitHub Pages.

**Fuori da M1** (esplicitamente): `ModelEnricher`, batching, cache,
modello per-dot da config, memoria persistente, split/merge dei dot,
le altre 4 fonti.

## 8. LLM Wiki (pattern Karpathy) applicata a Dot World

Riferimento: `llm-wiki.md` di Karpathy — sorgenti grezze immutabili, un
livello wiki scritto **interamente dall'LLM**, e uno schema che rende
l'agente un manutentore disciplinato. Tre operazioni: Ingest, Query, Lint.

**Cosa cambia rispetto a una doc tecnica normale:** la wiki *accumula*. Una
risposta buona non muore in chat — si archivia come pagina. Il costo della
manutenzione (cross-reference, coerenza, segnalare che un dato nuovo
contraddice uno vecchio) è quasi zero perché lo paga l'LLM, ed è
esattamente il costo per cui gli umani abbandonano le wiki.

Lingua: **inglese**, tutta. Le conversazioni restano in italiano.

### 8.1 I tre livelli, in `_knowledge/`

```
_knowledge/                    # IL LAYER DI COERENZA — nessun codice applicativo qui
  raw/                      # SORGENTI IMMUTABILI — l'LLM legge, non scrive mai
    runs/*.jsonl            # run log: la sorgente primaria di questo progetto
    bench/*.md              # misure Ollama: latenza p50/p95, % JSON invalido
    reading/*.md            # articoli/paper letti (stigmergia, agenti, ecc.)
    conversations/*.md      # sessioni di design salvate, con data
    portfolio/              # snapshot dei riferimenti: diagramma, dot-world.html
  wiki/                     # L'LLM POSSIEDE QUESTO LIVELLO — tu leggi, lui scrive
    index.md                # catalogo: ogni pagina, un link, una riga
    log.md                  # append-only, cronologico
    glossary.md
    decisions/ concepts/ contracts/ recipes/ sources/ findings/
  lint/wiki.test.ts         # la metà automatizzata del Lint (§8.5)
AGENTS.md                   # LO SCHEMA — resta in root: è il punto d'ingresso
CLAUDE.md                   # 3 righe → AGENTS.md
src/                        # codice
  core/AGENTS.md            # istruzioni LOCALI — restano accanto al codice
  models/AGENTS.md
  news/AGENTS.md
  web/AGENTS.md
```

**Perché un contenitore unico.** Una linea netta fra layer di coerenza e
layer di codice, che si traduce in cose concrete:
- `tsconfig.json` esclude `_knowledge/**` tranne `_knowledge/lint/`
- Vite non vede mai quella cartella: zero markdown nel bundle
- `.gitattributes`: `_knowledge/** linguist-documentation` — le statistiche di
  linguaggio di GitHub continuano a dire "TypeScript", non "Markdown"
- job CI separato (`wiki`) da quello di build
- Obsidian apre `_knowledge/wiki/` direttamente come vault

**Perché gli `AGENTS.md` annidati NON traslocano.** Il loro unico valore è
la prossimità: la risoluzione "vince il file più vicino" funziona solo se
stanno nell'albero del codice. Sono ~20 righe di invarianti locali che
**puntano** dentro la wiki, non la duplicano. Spostarli in `_knowledge/`
distrugge il meccanismo e lascia un file in più da aprire a mano.

**Perché il codice NON sta in `_knowledge/raw/`.** [Certo] Il pattern
presuppone sorgenti immutabili. Il codice cambia a ogni commit, ed è già la
verità: si legge direttamente, non si sintetizza. In `raw/` va ciò che il
codice **non** contiene e che non si può riderivare — i numeri di un run
reale, un articolo letto, una conversazione di design. È lì che sta il
valore che altrimenti evapora.

**Nota sul nome.** Prima `_system`, poi rinominata in `_knowledge/` su
decisione dell'utente. Il motivo, per memoria: lì dentro non c'è nessun
"sistema", c'è conoscenza, e un agente che entra freddo rischiava di leggere
`_system` come build plumbing da non toccare — l'opposto dello scopo, visto
che tutto il valore di quel layer sta nell'essere trovato e usato.

### 8.2 Le pagine della wiki

Categorie (non cartelle rigide — l'indice è il vero navigatore):

| categoria | cos'è | esempi |
|---|---|---|
| `sources/` | riassunto di una sorgente in `_knowledge/raw/` | `run-2026-09-12-ollama-llama32.md` |
| `concepts/` | un'idea del progetto | `marks-stigmergy.md`, `percept.md`, `deliberation-budget.md` |
| `decisions/` | ADR — con **"What NOT to do"** obbligatorio | `0002-sync-ticks-async-reasoning.md` |
| `contracts/` | interfacce e invarianti | `step-function.md`, `language-model.md` |
| `recipes/` | passo-passo con i file da toccare | `add-a-news-source.md` |
| `findings/` | **risposte archiviate** — l'output di una Query | `why-small-models-fail-json.md` |
| `glossary.md` | unica fonte di verità sui termini | mark vs stimulus, intent vs intention |

`findings/` è la categoria che nel mio impianto precedente mancava, ed è
quella che fa compounding: ogni volta che chiedo alla wiki qualcosa di non
banale e la risposta è buona, diventa una pagina.

Front-matter:

```yaml
---
id: concepts/marks-stigmergy
type: concept | decision | contract | recipe | source | finding
title: What a mark is, and why dots never talk to each other
covers: [src/core/marks.ts, src/core/grid.ts]   # solo per pagine legate al codice
exports: [Mark, applyMark, decayMarks]           # simboli che devono esistere
sources: [_knowledge/raw/reading/stigmergy-theraulaz-1999.md]
depends_on: [concepts/world-state, glossary#stigmergy]
updated: 2026-09-04
---
```

Regole di scrittura (in `AGENTS.md`): una pagina = una domanda, il titolo
*è* la domanda; max ~120 righe, se cresce si spacca; niente duplicazione —
un fatto vive in una pagina sola; apertura con **"When to open this page"**
(routing per l'agente, non cortesia); chiusura con **"See also"**.

### 8.3 `index.md` e `log.md`

**`index.md`** — orientato al contenuto. Ogni pagina con link, una riga di
sintesi, la data. L'agente lo legge **per primo** e poi scende nelle pagine
rilevanti. [Probabile] A questa scala (decine-centinaia di pagine) sostituisce
del tutto un RAG con embedding, ed è ispezionabile a occhio — un vantaggio
che un indice vettoriale non ha.

**`log.md`** — cronologico, append-only. Prefisso fisso perché resti
greppabile con strumenti unix:

```
## [2026-09-12] ingest | run-2026-09-12-ollama-llama32
## [2026-09-12] query  | why do small models fail structured output
## [2026-09-13] lint   | 3 stale pages, 1 orphan
```

`grep "^## \[" _knowledge/wiki/log.md | tail -5` = cos'è successo di recente. È anche
come una sessione nuova capisce dove eravamo rimasti.

### 8.4 Le tre operazioni, definite per questo progetto

**Ingest** — arriva una sorgente in `_knowledge/raw/`. L'LLM la legge, ne discute con
me i punti chiave, scrive `_knowledge/wiki/sources/<id>.md`, **aggiorna le pagine
concettuali toccate** (è qui il lavoro vero: una sorgente sola può toccare
10-15 pagine), aggiorna `index.md`, appende a `log.md`. Se una sorgente
nuova contraddice una pagina esistente, la contraddizione va **annotata,
non risolta in silenzio**.

**Query** — domanda alla wiki. L'LLM legge `index.md`, apre le pagine,
risponde **con citazioni alle pagine**. Se la risposta è buona: si archivia
in `findings/`, si linka dalle pagine correlate, si aggiorna l'indice.

**Lint** — health check periodico. Contraddizioni fra pagine, affermazioni
superate da sorgenti più recenti, pagine orfane senza link entranti,
concetti citati ovunque ma senza pagina propria, cross-reference mancanti,
buchi da colmare. Produce una lista di domande da investigare — non
modifica nulla da solo.

### 8.5 Lint su due livelli — la mia aggiunta al pattern

Karpathy descrive un Lint guidato dall'LLM. Su un progetto software una
classe di drift è **meccanicamente decidibile**, e lasciarla a un giudizio
soggettivo è sprecare un test che si può scrivere.

**Livello 1 — `_knowledge/lint/wiki.test.ts`, dentro `npm test`.** Fallisce se:
1. un link interno non risolve (file o ancora)
2. un glob in `covers:` non matcha nessun file reale
3. un simbolo in `exports:` non è più esportato davvero (parsing degli
   export TS, non regex sul testo)
4. un termine del glossario è usato senza essere definito
5. `_knowledge/wiki/index.md` è disallineato rispetto ai front-matter presenti
6. una pagina è **orfana** (nessun link entrante, e non è in `index.md`)
7. **staleness**: file in `covers:` con commit successivi a `updated:`
   → **warning in locale, errore in CI con `--strict`** (scelta confermata)

**Livello 2 — Lint dell'LLM**, che il test non può vedere: contraddizioni
fra pagine, claim diventati falsi, sintesi da rifare, domande aperte.
Si esegue a mano quando serve, e scrive la sua riga in `_knowledge/wiki/log.md`.

Il livello 1 protegge le pagine con `covers:` (legate al codice mutevole).
Il livello 2 protegge le pagine derivate da sorgenti stabili.

### 8.6 Cosa esiste al momento zero

[Certo] Non c'è codice, quindi `contracts/` e `recipes/` documenterebbero il
nulla. Nascono con il codice che descrivono (§10). Ora si scrive:

- `AGENTS.md` — lo schema: struttura, front-matter, regole di scrittura, e
  i tre workflow scritti come procedure eseguibili da un agente
- `CLAUDE.md` — puntatore di 3 righe
- `_knowledge/wiki/index.md` e `log.md` — vuoti ma con il formato fissato
- `_knowledge/wiki/glossary.md` — prima di tutto: *mark* vs *stimulus*, *intent* vs
  *intention*, *deliberation* vs *reasoning* si confondono da soli, e dopo
  costano una rinomina globale
- le 5 `_knowledge/wiki/decisions/` — l'unica categoria conoscibile senza codice, e quella
  che impedisce a un agente futuro di "semplificare" via `ScriptedPolicy` o
  di convertire i tick in loop asincroni perché sembrano più moderni
- `_knowledge/raw/portfolio/` — snapshot del diagramma e di `dot-world.html`, così la
  wiki ha una sorgente da cui è nata
- `_knowledge/lint/wiki.test.ts` — nasce con la wiki, mai dopo

### 8.7 Lo stesso pattern è anche il design della memoria di un dot

[Ipotesi] — non per M1, ma va scritto ora perché cambia una scelta del §4.

Al §4 la memoria di un dot è un *ring buffer*, cioè amnesia programmata. Ma
Dot World ingerisce notizie in continuo: un dot **è** una wiki che accumula
da un flusso di sorgenti. La mappatura è esatta:

| Karpathy | Dot World |
|---|---|
| raw sources immutabili | gli `Stimulus` arrivati |
| wiki | ciò che il dot ha capito del mondo |
| schema | la sua personalità + interessi |
| Ingest | aggiornare le convinzioni quando arriva uno stimolo saliente |
| Query | **la deliberazione**: dato quel che so, cosa faccio |
| Lint | consolidamento e dimenticanza |
| `index.md` letto per primo | è ciò che tiene il percept sotto i 400 token |

Struttura proposta a due livelli, coerente con la stigmergia:
- una **world wiki condivisa**, ingerita una volta per stimolo e letta da
  tutti — costo ammortizzato su N dot, ed è un altro livello di stato
  condiviso, non un canale diretto fra dot
- un **delta privato per dot**, piccolo: cosa *io* penso di quel topic

Da rivalutare a M2 con numeri veri. Se il delta privato costa troppo, resta
la sola world wiki e i dot si differenziano per interessi, non per memoria.

## 9. Verifica — cosa deve essere verde prima di dire "fatto"

1. `npx tsc --noEmit` pulito
2. `npm test` (Vitest):
   - **determinismo**: stesso seed + `ScriptedPolicy` → hash dello stato
     identico dopo 1000 tick, su due run separati
   - risoluzione dei conflitti fra intent (movimento clampato, rinforzo
     delle marche, ordinamento)
   - `buildPercept` su stati fissi → percept atteso, e sotto i 400 token
   - parser JSON delle decisioni su fixture di risposte reali, incluse
     malformate → retry → fallback, mai un'eccezione che sfugge
   - decadimento delle marche e degli stimoli
   - **`_knowledge/lint/wiki.test.ts`** (§8.5): link, `covers`, `exports`, glossario, indice
3. `npm run world -- --ticks 1000 --policy scripted` — nessun errore,
   produce `run.jsonl`, poi `--replay run.jsonl` riproduce lo stesso hash
4. Con Ollama disponibile: `--policy=model` per 200 tick — si riporta il
   numero reale di chiamate, la latenza p50/p95 e la percentuale di JSON
   invalido. **Anche se è brutto.**
5. **Playwright** (Chromium in `/opt/pw-browsers/chromium`): il viewer
   carica, 12 dot sul canvas, le marche compaiono e sbiadiscono, l'ispettore
   si apre al click, **zero errori in console**

## 10. Ordine di lavoro

Ogni step chiude con **Ingest**: la wiki si aggiorna insieme al codice, e la
riga corrispondente finisce in `_knowledge/wiki/log.md`. Nessuno step è "fatto" se la
wiki non l'ha assorbito.

1. scaffold (TS + Vite + Vitest) + `_knowledge/raw/portfolio/` (snapshot diagramma e
   `dot-world.html` da `ottobit/portfolio`)
2. **wiki al momento zero** (§8.6): `AGENTS.md` con i 3 workflow,
   `CLAUDE.md`, `_knowledge/wiki/{index,log,glossary}.md`,
   le 5 `_knowledge/wiki/decisions/`, e `_knowledge/lint/wiki.test.ts` verde
3. `core`: stato, RNG seedato, `step()`, intent, griglia — test di
   determinismo **prima** di qualsiasi cosa si veda
   → `contracts/step-function.md`, `concepts/world-state.md`,
     `concepts/intent-vs-intention.md`, `src/core/AGENTS.md`
4. `ScriptedPolicy` + runner headless + log JSONL
   → `contracts/decision-policy.md`; il primo `run.jsonl` va in `_knowledge/raw/runs/`
     ed è la prima vera Ingest del progetto
5. viewer canvas + replay → `src/web/AGENTS.md`
6. news: 2 fonti + `KeywordEnricher` + stimoli nel mondo
   → `contracts/news-source.md`, `concepts/stimulus-pipeline.md`,
     `recipes/add-a-news-source.md`, `src/news/AGENTS.md`
7. `LanguageModel` + `ModelPolicy` + `DeliberationScheduler` con il cap
   → `contracts/language-model.md`, `concepts/deliberation-budget.md`,
     `recipes/add-a-model-provider.md`, `src/models/AGENTS.md`
8. ispettore nel viewer
9. run con Ollama → `_knowledge/raw/bench/`, Ingest, e la prima pagina `findings/`
   con i numeri veri (latenza p50/p95, % JSON invalido)
10. prima **Lint** completa: contraddizioni, pagine orfane, buchi
