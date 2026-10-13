# Product trade-offs — teaching reference

Use these to explain *why* a question matters. Quote the one-line idea, then apply it to
the case at hand. Don't lecture the whole file.

## Core PO concepts

| Concept | One-line idea | Question it prompts |
| --- | --- | --- |
| Jobs to be done | People "hire" a product to make progress in a specific moment. | What is happening at the table, and what does "done" feel like? |
| Opportunity cost | Every yes is a no to everything else you could build with that time. | What gets delayed if we do this? |
| MVP slicing | Ship the thinnest version that tests the riskiest assumption. | What's the smallest thing we can try at the next café session? |
| Vertical slice | A story is done when it works end to end for a player, even if ugly. | Can a player use this at the table after this one PR? |
| One-way vs two-way doors | Reversible decisions should be fast; irreversible ones slow and careful. | Can we undo this cheaply (stored room format, shared links, IDs)? |
| MoSCoW | Must blocks a playable session; Should removes friction seen in a playtest; Could is delight; Won't is written down so it stops coming back. | Would the table still finish a session without it? |
| Kano model | Must-be features cause anger when missing but no delight when present; delighters are the reverse. | Will friends complain without it, or smile with it? |
| Scope creep | Each small addition is reasonable; their sum dilutes the product. | Would we add this if it were the 10th such request? |
| Feature debt | Every feature costs tests, copy and attention forever — now on two clients. | Who keeps this working on Telegram *and* the web? |
| North Star | One measure that captures delivered value aligns all decisions. | Does this help a session run with no human game master? |
| Confidence | Unvalidated ideas are guesses; score them as guesses. | Did it come from a playtest, from us, or from a hunch? |

## RICE-lite in practice

- **Impact** is relative to the North Star bars and core use case criteria, not to how fun
  the idea sounds. A 3 should be rare.
- **Confidence 0.5** is honest for an idea nobody has seen at a table. Raise it with
  evidence: a playtest note, a timed run, a balance number.
- **Effort** includes tests, both clients, copy and docs — not just code.
- Scores rank; they don't decide. If the ranking feels wrong, find the factor you
  mis-estimated rather than overriding silently.

## Recurring A3 Spy trade-offs

### Telegram only vs a web app

- **Options:** (a) Telegram only, (b) Telegram Mini App inside Telegram, (c) a standalone
  web app / PWA, (d) native apps.
- **Trade-off:** (a) is free and done, but excludes friends without Telegram or who never
  started the bot. (b) keeps Telegram identity but still requires Telegram. (c) lets anyone
  join by QR and a name, at the cost of a second client to keep in sync. (d) costs store
  accounts and review cycles for a < 30 user audience.
- **Decided 2026-10-13:** (c), as mixed tables with guest identity (M3). Revisit identity
  (Telegram Login) when long-term stats (M5) come up.

### Identity: guest name vs account

- A guest name is one step at the table (principle 1) but means a web player and a
  Telegram player are different people, and clearing the browser makes a new guest. An
  account or Telegram Login links them but adds a step and a dependency. For a café table,
  the step costs more than the lost stats.

### Host-paced vs timers

- Timers keep a slow table moving but make the app set the pace (principle 3) and add
  stress. Default off; a host setting at most, and only if playtests show the host
  forgetting to open or close votes.

### Configurable vs good defaults

- Every setting is a screen the host must understand. Prefer a better default (the role
  table) over a knob; add a knob only when two tables genuinely want different things.

### Balance vs simplicity

- When the spy side wins outside 35–55 %, change the default role counts first; new roles
  or special powers make the rules harder for newcomers (UC-1 says understand in 30 s).

### Secrecy vs convenience

- Showing the word on a lock-screen notification, in a link preview or in a shared screen
  would save a tap but break the non-negotiable. The answer is always a tap to reveal on
  the owner's own device.

### Free plan vs features

- Real-time features, storage and scheduled jobs all eat into the Workers free plan. Any
  idea that scales per player per second (live typing, presence pings, animations driven
  by the server) needs a cost estimate before it is scored.

### Inside jokes vs comfort

- Inside-joke word pairs are the group's favourite feature and its biggest social risk.
  A pair about a person needs that person's OK; keep the review question open in
  `word-packs.md` until someone owns it.
