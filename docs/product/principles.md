# Design principles

Ordered. When two principles conflict, the higher one wins. Every principle has a cost; it
is listed so the trade-off is visible when deciding.

## 1. Eyes on each other, not on the screen

The game happens at the table. Phones come out only to read a word, vote and see a result,
with at most 1–2 taps each time.

- On a remote table the voice call is the table: the screen shows whose turn it is to
  speak and stays as quiet as at the café.
- One idea per message or screen; lead with the point.
- No feeds, chat, emoji reactions, animations to wait for or anything else that keeps eyes
  down.
- Typing is a smell. The only typed inputs are a display name (web) and Mr. White's guess.
- **Cost:** fewer features fit; anything "fun on the phone" is a default no.

## 2. Nobody gets stuck

A café table is noisy and people come and go. The game must keep moving with no one fixing
it by hand.

- If the host leaves, the earliest remaining joiner becomes host; an empty room closes.
- If someone does not vote, the host closes the vote anyway.
- A reload, a locked phone or a dropped connection puts the player back in their seat.
- Voice is never required to advance: if a player's call drops, the game goes on and the
  call reconnects.
- Every tap is answered, even a stale or rejected one.
- **Cost:** more edge cases to build and test than the happy path suggests.

## 3. The host sets the pace

A3 Spy never rushes the table. The host decides when talk is over and the vote opens.

- No timers by default; optional timers are a host setting, off by default.
- **Cost:** a slow host slows the table; that is a social problem, not a product one.

## 4. Friends, not strangers

The audience is one friend group of fewer than 30 people.

- Vietnamese only. Inside jokes and banter are welcome; mocking a player is not.
- No onboarding funnels, growth loops, accounts or monetisation.
- Simple beats configurable: a good default over a settings screen.
- **Cost:** some things a public product would need (moderation, abuse limits,
  localisation) are deliberately missing.

## Always-on constraints (not traded off)

- **Secrets stay secret**, **Nobody gets stuck**, **One game, one truth**, **Free to run**:
  see [strategy](strategy.md#non-negotiable).
