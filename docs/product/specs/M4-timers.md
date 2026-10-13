# M4 Optional timers

Status: shipped 2026-10-14   ·   Serves: UC-3   ·   Roadmap: Shipped

## Problem

Some tables talk for ages and the host forgets to open or close the vote. A timer that
tells the whole table "time is up" keeps the pace without taking control from the host
(principle 3: the host sets the pace).

## Decisions (2026-10-14)

| Topic | Decision |
| --- | --- |
| What happens at the end | **Reminder only.** A3 Spy tells every player that time is up; the host still opens and closes the vote. Nothing happens automatically. |
| Which timers | Discussion (from the start of a round until the vote opens) and vote (from the vote opening until it closes, restarting on a revote). |
| Durations | Discussion: off, 2, 3 or 5 minutes. Vote: off, 1 or 2 minutes. Both off by default. |
| Where | Host settings in the lobby, next to spies and themes (both clients). Kept for play again like other settings. |
| Telegram | The round and vote messages say how long there is; at the end one "time is up" message goes to every player. No countdown edits. |
| Web | A live countdown on the game screen; "time is up" when it reaches zero. |

## User stories

| ID | Story | Priority |
| --- | --- | --- |
| G5 ([#13](https://github.com/mazino2d/a3spy/issues/13)) | As a host, I turn on a timer for discussion or voting so the table keeps its pace when talk drags on. | Could |

## Acceptance criteria

- **AC1** Given a new room, then both timers are off.
- **AC2** Given the host's lobby, when the host taps a timer, then it cycles through its durations and every lobby shows the new value; only the host sees the controls.
- **AC3** Given a discussion timer of N minutes, when a round starts, then players see that there are N minutes; after N minutes, if the vote is still not open, every player is told that time is up and the host is reminded to open the vote.
- **AC4** Given a vote timer of N minutes, when a vote or revote opens, then players see that there are N minutes; after N minutes, if that vote is still open, every player is told that time is up and the host is reminded to close the vote.
- **AC5** Given a timer is running, when the phase changes before it ends (the host opens or closes the vote, the game ends), then no reminder is sent for it.
- **AC6** Given a timer ends, then nothing else changes: the vote is not opened or closed and nobody is eliminated.
- **AC7** Given a web player during a timed phase, then they see the time left counting down, and "time is up" once it has passed.

## Edge cases checklist

- Restart or deploy while a timer runs: the deadline is stored with the room, so the reminder still comes.
- Host leaves: the timer keeps running; the new host is the one reminded.
- The idle close (6 h) and the timer share one alarm; neither may cancel the other.

## Out of scope

- Opening or closing the vote automatically (rejected 2026-10-14: the host keeps the pace).
- Sounds, vibration, push notifications.

## Success check

At a session with a timer on, the host is reminded instead of the table having to chase them.
