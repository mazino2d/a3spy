import { useEffect, useState } from "preact/hooks";
import type { GameView, PublicEvent, RoomView } from "../../../src/game/view";
import { t } from "../messages";
import { go } from "../route";
import type { RoomProps } from "./Room";

const nameOf = (view: RoomView, id: number) =>
  view.game?.dealt.find((p) => p.id === id)?.name ?? view.players.find((p) => p.id === id)?.name ?? "?";

export interface GameProps extends RoomProps {
  /** What happened at the last vote, to show until the next one opens. */
  outcome: PublicEvent[];
  onScore(): void;
}

/** Every phase of a running game, driven only by the view. */
export function Game(props: GameProps) {
  const { view } = props;
  const game = view.game as GameView;
  const isHost = view.me === view.hostId;

  return (
    <main class="screen">
      <header class="row between">
        <h1 class="small-title">{t.gameRound(game.id, game.round)}</h1>
        <button type="button" class="link small" onClick={props.onScore}>
          {t.score}
        </button>
      </header>

      {game.hand ? <WordCard word={game.hand.word} gameId={game.id} /> : <p class="card">{t.waitingNext}</p>}

      {props.outcome.length > 0 && <Outcome view={view} events={props.outcome} />}

      {game.timer && <Countdown kind={game.timer.kind} endsAt={game.timer.endsAt} />}

      {game.phase === "describing" && <Describing {...props} game={game} isHost={isHost} />}
      {game.phase === "voting" && <Voting {...props} game={game} isHost={isHost} />}
      {game.phase === "white_guess" && <WhiteGuess {...props} game={game} isHost={isHost} />}
    </main>
  );
}

/** Time left in a timed phase, from the server's deadline. Only a reminder: nothing happens at zero. */
function Countdown({ kind, endsAt }: { kind: string; endsAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  if (left === 0)
    return (
      <p class="timer up" role="status">
        {t.timeUp[kind]}
      </p>
    );
  const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return <p class="timer">{t.timeLeft(text)}</p>;
}

/**
 * The secret word, face down. Tap to reveal; it hides again after 5 s or on the next tap.
 * Civilians and spies see the same card; only Mr. White's says what he is.
 */
function WordCard({ word, gameId }: { word: string | null; gameId: number }) {
  const [shown, setShown] = useState(false);

  useEffect(() => setShown(false), [gameId]);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(false), 5000);
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <button
      type="button"
      class={`word-card${shown ? " shown" : ""}`}
      aria-label={shown ? undefined : t.tapToReveal}
      onClick={() => setShown(!shown)}
    >
      {shown ? (
        word === null ? (
          <>
            <span class="label">🤫</span>
            <strong>{t.youAreWhite}</strong>
            <span class="small">{t.whiteHint}</span>
          </>
        ) : (
          <>
            <span class="label">🤫 {t.yourWord}</span>
            <strong>{word}</strong>
            <span class="small muted">{t.wordHides}</span>
          </>
        )
      ) : (
        <>
          <span class="label">🕵️ {t.tapToReveal}</span>
          <span class="small muted">{t.tapToRevealHint}</span>
        </>
      )}
    </button>
  );
}

function Outcome({ view, events }: { view: RoomView; events: PublicEvent[] }) {
  const lines: string[] = [];
  let tally: [number, number][] = [];
  for (const e of events) {
    if (e.type === "vote_closed")
      tally = Object.entries(e.tally)
        .map(([id, n]): [number, number] => [Number(id), n])
        .sort((a, b) => b[1] - a[1]);
    else if (e.type === "tie") lines.push(t.tie(e.tied.map((id) => nameOf(view, id)).join(", ")));
    else if (e.type === "no_elimination") lines.push(e.reason === "tie" ? t.noEliminationTie : t.noEliminationNoVotes);
    else if (e.type === "eliminated") lines.push(`❌ ${t.eliminated(nameOf(view, e.playerId), t.roles[e.role] ?? "")}`);
    else if (e.type === "left") lines.push(`🚪 ${t.left(e.player.name)}`);
    else if (e.type === "white_guessed")
      lines.push(`${e.correct ? "🎯" : "🙅"} ${t.whiteGuessed(nameOf(view, e.playerId), e.guess, e.correct)}`);
  }
  if (!tally.length && !lines.length) return null;
  return (
    <section class="card" aria-live="polite">
      {events.some((e) => e.type === "vote_closed") && (
        <>
          <h2>📊 {t.tally}</h2>
          {tally.length ? (
            <ul class="plain">
              {tally.map(([id, n]) => (
                <li key={id} class="row between">
                  <span>{nameOf(view, id)}</span>
                  <span class="muted">{t.votes(n)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="muted">{t.noVotes}</p>
          )}
        </>
      )}
      {lines.map((line) => (
        <p key={line}>
          <strong>{line}</strong>
        </p>
      ))}
    </section>
  );
}

type PhaseProps = GameProps & { game: GameView; isHost: boolean };

function Describing({ view, game, isHost, online, send }: PhaseProps) {
  const alive = game.alive.includes(view.me);
  const dead = game.dealt.filter((p) => !game.alive.includes(p.id));
  return (
    <>
      <section>
        <h2>🗣 {t.speakingOrder}</h2>
        <ol class="players">
          {game.order.map((id) => (
            <li key={id} class={id === view.me ? "me" : undefined}>
              {nameOf(view, id)}
              {id === view.me && <span class="muted"> ({t.you})</span>}
            </li>
          ))}
        </ol>
        {dead.length > 0 && (
          <ul class="plain dead">
            {dead.map((p) => (
              <li key={p.id}>
                ✝ {p.name}: {t.roles[game.roles[p.id] ?? ""] ?? "?"}
              </li>
            ))}
          </ul>
        )}
      </section>
      <footer class="actions">
        {game.hand && !alive && <p class="muted center-text">{t.youAreOut}</p>}
        {alive && !isHost && <p class="muted center-text">{t.describeHint}</p>}
        {isHost && (
          <>
            <p class="muted small center-text">{t.hostVoteHint}</p>
            <button
              type="button"
              class="primary big"
              disabled={!online}
              onClick={() => send({ type: "command", action: "openVote", gameId: game.id, round: game.round })}
            >
              {t.openVote}
            </button>
            <EndButton game={game} online={online} send={send} />
          </>
        )}
      </footer>
    </>
  );
}

function EndButton({ game, online, send }: Pick<PhaseProps, "game" | "online" | "send">) {
  return (
    <button
      type="button"
      class="secondary"
      disabled={!online}
      onClick={() => {
        if (confirm(t.confirmEnd)) send({ type: "command", action: "end", gameId: game.id });
      }}
    >
      {t.endGame}
    </button>
  );
}

function Voting({ view, game, isHost, online, send }: PhaseProps) {
  const canVote = game.canVoteFor.length > 0;
  return (
    <>
      <section>
        <h2>
          🗳 {t.vote(game.round, game.revote)} · {t.voteCount(game.votes.count, game.votes.total)}
        </h2>
        {canVote ? (
          <>
            <p class="muted">
              {game.myVote === null ? t.votePrompt(game.revote) : t.votedFor(nameOf(view, game.myVote))}
            </p>
            <div class="stack vote-list">
              {game.canVoteFor.map((id) => (
                <button
                  key={id}
                  type="button"
                  class={id === game.myVote ? "vote chosen" : "vote"}
                  aria-pressed={id === game.myVote}
                  disabled={!online}
                  onClick={() =>
                    send({ type: "command", action: "vote", gameId: game.id, round: game.round, target: id })
                  }
                >
                  {id === game.myVote ? "✅ " : ""}
                  {nameOf(view, id)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p class="muted">{game.hand && !game.alive.includes(view.me) ? t.youAreOut : t.watching}</p>
        )}
      </section>
      <footer class="actions">
        <p class="muted small center-text">{t.autoClose}</p>
        {isHost && (
          <>
            <button
              type="button"
              class="primary"
              disabled={!online}
              onClick={() => send({ type: "command", action: "closeVote", gameId: game.id, round: game.round })}
            >
              {t.closeVote}
            </button>
            <EndButton game={game} online={online} send={send} />
          </>
        )}
      </footer>
    </>
  );
}

function WhiteGuess({ view, game, online, send }: PhaseProps) {
  const [guess, setGuess] = useState("");
  if (game.guesser !== view.me)
    return <p class="card center-text">⏳ {t.guessing(game.guesser === null ? "?" : nameOf(view, game.guesser))}</p>;
  return (
    <form
      class="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (guess.trim()) send({ type: "command", action: "guess", text: guess.trim() });
      }}
    >
      <label for="guess">{t.guessPrompt}</label>
      <input
        id="guess"
        autoComplete="off"
        enterKeyHint="send"
        maxLength={64}
        placeholder={t.guessPlaceholder}
        value={guess}
        onInput={(e) => setGuess(e.currentTarget.value)}
      />
      <button type="submit" class="primary" disabled={!online || !guess.trim()}>
        {t.guessSubmit}
      </button>
    </form>
  );
}

/** The reveal: who won, both words, every role. The host deals again from here. */
export function GameOver(props: GameProps) {
  const { view, online, send } = props;
  const game = view.game as GameView;
  const isHost = view.me === view.hostId;
  return (
    <main class="screen">
      <header class="row between">
        <h1 class="small-title">{t.gameRound(game.id, game.round)}</h1>
        <button type="button" class="link small" onClick={props.onScore}>
          {t.score}
        </button>
      </header>
      {props.outcome.length > 0 && <Outcome view={view} events={props.outcome} />}
      <section class="card center">
        <h1>{game.winner ? t.winner[game.winner] : t.endedEarly}</h1>
        {game.words && (
          <div class="words">
            <p>
              {t.civilianWord}: <strong>{game.words.civilian}</strong>
            </p>
            <p>
              {t.spyWord}: <strong class="odd">{game.words.spy}</strong>
            </p>
          </div>
        )}
      </section>
      <section>
        <h2>🃏 {t.reveal}</h2>
        <ul class="plain">
          {game.dealt.map((p) => (
            <li key={p.id} class={`row between${p.id === view.me ? " me" : ""}`}>
              <span>
                {game.alive.includes(p.id) ? "•" : "✝"} {p.name}
              </span>
              <span class={game.roles[p.id] === "civilian" ? "muted" : "odd"}>{t.roles[game.roles[p.id] ?? ""]}</span>
            </li>
          ))}
        </ul>
      </section>
      <footer class="actions">
        {isHost ? (
          <button
            type="button"
            class="primary big"
            disabled={!online}
            onClick={() => send({ type: "command", action: "again", gameId: game.id, round: game.round })}
          >
            {t.playAgain}
          </button>
        ) : (
          <p class="muted center-text">{t.waitAgain}</p>
        )}
        <button type="button" class="link small" onClick={() => send({ type: "command", action: "leave" })}>
          {t.leave}
        </button>
      </footer>
    </main>
  );
}

export function Scoreboard({ view, onClose }: { view: RoomView; onClose(): void }) {
  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label={t.scoreTitle}>
      <div class="sheet-body stack">
        <h2>🏅 {t.scoreTitle}</h2>
        {view.scores.length ? (
          <ol class="players">
            {view.scores.map((s) => (
              <li key={s.id} class={s.id === view.me ? "me" : undefined}>
                <span class="row between">
                  <span>{s.name}</span>
                  <strong>{s.wins}</strong>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p class="muted">{t.noScore}</p>
        )}
        <button type="button" class="link small" onClick={() => go({ name: "stats" })}>
          {t.longTermStats}
        </button>
        <button type="button" class="secondary" onClick={onClose}>
          {t.close}
        </button>
      </div>
    </div>
  );
}
