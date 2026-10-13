import { useEffect, useState } from "preact/hooks";
import { getStats, type Me, type Stats } from "../api";
import { t } from "../messages";
import { go } from "../route";

const pct = (s: Pick<Stats, "games" | "wins">) => (s.games ? Math.round((s.wins / s.games) * 100) : 0);

/** Long-term stats: the player's own numbers and the group leaderboard. */
export function StatsScreen({ me }: { me: Me }) {
  const [data, setData] = useState<{ me: Stats | null; board: Stats[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getStats()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const back = () =>
    history.length > 1 ? history.back() : go(me.room ? { name: "room", code: me.room } : { name: "home" });

  return (
    <main class="screen">
      <header class="row between">
        <h1>{t.statsTitle}</h1>
        <button type="button" class="link small" onClick={back}>
          {t.back}
        </button>
      </header>
      {failed && <p class="error">{t.network}</p>}
      {!data && !failed && <p class="muted">{t.connecting}</p>}
      {data && (
        <>
          <section class="card">
            <h2>{t.statsMine}</h2>
            {data.me ? (
              <>
                <p>
                  <strong>{t.statsTotal(data.me.games, data.me.wins, pct(data.me))}</strong>
                </p>
                {data.me.spy.games > 0 && <p>{t.statsSpy(data.me.spy.games, data.me.spy.wins)}</p>}
                {data.me.white.games > 0 && (
                  <p>{t.statsWhite(data.me.white.games, data.me.white.wins, data.me.white.correct)}</p>
                )}
              </>
            ) : (
              <p class="muted">{t.statsNone}</p>
            )}
          </section>
          <section>
            <h2>{t.statsBoard}</h2>
            {data.board.length ? (
              <ol class="players">
                {data.board.map((s) => (
                  <li key={s.id} class={s.id === me.id ? "me" : undefined}>
                    <span class="row between">
                      <span>{s.name}</span>
                      <span class="muted small">{t.statsBoardLine(s.wins, s.games, pct(s))}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p class="muted">{t.statsBoardEmpty}</p>
            )}
          </section>
          <p class="muted small center-text">{t.statsWebNote}</p>
        </>
      )}
    </main>
  );
}
