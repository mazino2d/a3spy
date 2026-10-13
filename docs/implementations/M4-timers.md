# M4 Optional timers — implementation plan

Status: shipped 2026-10-14   ·   Spec: [M4 Optional timers](../product/specs/M4-timers.md)   ·   Written 2026-10-14 (after the fact, from #43)

How M4 was built: the decisions, the moving parts and the tests. The spec defines *what*
is true; this plan records *how*.

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Where the setting lives | `Settings.timers = { discussion, vote }` in minutes (0 = off), next to role counts and themes; host taps cycle through `TIMER_OPTIONS` (discussion 0/2/3/5, vote 0/1/2) | Reuses the M2 settings path end to end: `configure()`, the `configure` command, Telegram buttons and the web settings card. |
| What a timer is | A pure `Timer { kind, key, endsAt, fired }` in `src/game/timers.ts`; `key` is game, round, phase and revote flag | A deadline belongs to one phase. Comparing keys tells whether the phase it was started for is still current, with no event bookkeeping. |
| Starting and keeping | `nextTimer(room, current, now)` after every commit: same key → keep the same deadline; a new timed phase → new deadline; anything else → none | Commands inside a phase (votes, joins) never reset the clock; a revote gets a fresh one. |
| Where it is stored | `Stored.timer` in the RoomDO, not in `engine.Room` | The engine stays free of wall-clock time; only the Durable Object knows `Date.now()`. |
| Alarm | One alarm per room at `min(idle deadline, timer deadline)` (`RoomDO.schedule`) | A Durable Object has a single alarm; neither the 6 h idle close nor the reminder may cancel the other. |
| Firing | `alarm()` checks `isDue(room, timer, now)` first: due → mark `fired`, persist, push state to web players, send the Telegram reminder; else the idle path | Persisting `fired` before sending means a retried alarm never reminds twice; an early or stale alarm falls through to rescheduling. |
| What the reminder does | Only messages: every player gets "⏰ Hết giờ …", the host also gets the Open vote or Close vote button (`timerReminder` in `src/bot/render.ts`) | The spec's decision: the host keeps the pace (principle 3). |
| Telegram during the phase | One line in the round message ("⏱ Có N phút thảo luận") and in the vote panel ("⏱ Có N phút để vote"); no countdown edits | Editing every few seconds would cost subrequests and pull eyes to the phone. |
| Web during the phase | `GameView.timer { kind, endsAt }` only when the stored timer matches the current phase; a client-side countdown from `endsAt` | One state push per phase; the countdown runs locally. Small clock skew is acceptable for a reminder. |
| Stored rooms | `load()` fills missing `settings.timers` with the defaults | Rooms created before M4 keep working after the deploy. |

## Architecture

```text
command ──▶ RoomDO.commit
              room' = engine result
              timer' = nextTimer(room', timer, now)        (src/game/timers.ts, pure)
              persist { room', timer' }
              setAlarm(min(updatedAt + 6 h, timer'.endsAt if not fired))

alarm ────▶ RoomDO.alarm
              isDue(room, timer, now)?
                yes → timer.fired = true, persist, reschedule
                      push state to web sockets (view shows "time is up")
                      Telegram: timerReminder(room, kind) to every player, host gets the button
                no  → idle for 6 h? close the room : reschedule
```

## Phases

| Phase | Scope | ACs | PR | Status |
| --- | --- | --- | --- | --- |
| P1 | Spec, timer settings, pure timers, RoomDO alarm sharing, Telegram copy and buttons, web settings chips and countdown, rules | AC1–AC7 | #43 | Done |

One PR: the change is small and every part is needed for a timer to be useful.

## Tests

| Level | Where | Covers |
| --- | --- | --- |
| Unit | `test/unit/timers.test.ts` | Defaults off; cycling and host-only; discussion deadline and `isDue`; vote timer restarting on a revote; no reminder after the phase moved on; view carries only the current phase's timer; callback encoding |
| Integration | `test/integration/game.test.ts` › timers over Telegram | Lobby line and round note; a due alarm (deadline moved into the past with `runInDurableObject`, fired with `runDurableObjectAlarm`) reminds all players, gives the host Open vote, opens nothing; a second alarm sends nothing |
| Browser | Headless Chrome run recorded in #43 | Timer chips, other players' summary, discussion and vote countdowns |

## Known limits

- The countdown on the web uses the phone's clock against the server deadline; a phone
  minutes off would show a wrong time left (the reminder itself comes from the server).
- Durable Object alarms can fire a little late; reminders are not to-the-second.
