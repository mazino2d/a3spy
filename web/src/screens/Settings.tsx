import type { SettingsChange } from "../../../src/game/engine";
import type { RoomView } from "../../../src/game/view";
import { t } from "../messages";

interface Props {
  view: RoomView;
  online: boolean;
  /** Present for the host only: everyone else sees a summary. */
  change?: (change: SettingsChange) => void;
}

/** The game settings in the lobby: editable by the host, a summary for everyone else. */
export function Settings({ view, online, change }: Props) {
  const s = view.settings;
  const themesOn = s.themes.filter((th) => th.on);
  const themesText = themesOn.length === s.themes.length ? t.allThemes : themesOn.map((th) => th.name).join(", ");

  if (!change)
    return (
      <section class="card">
        <h2>{t.settings}</h2>
        <p>
          {s.spies === null || s.white === null
            ? t.autoPending
            : `${s.spies} ${t.spies} · ${t.mrWhite}: ${s.white ? t.on : t.off}`}
        </p>
        <p class="muted small">
          {t.themes}: {themesText}
        </p>
        {(s.timers.discussion > 0 || s.timers.vote > 0) && (
          <p class="muted small">{t.timersSummary(s.timers.discussion, s.timers.vote)}</p>
        )}
      </section>
    );

  const disabled = !online;
  return (
    <section class="card stack">
      <h2>{t.settings}</h2>
      <div class="row between">
        <span>{t.spies}</span>
        <div class="row stepper">
          <button
            type="button"
            class="secondary"
            aria-label={t.fewerSpies}
            disabled={disabled || (s.spies ?? 1) <= 1}
            onClick={() => change({ kind: "spies", delta: -1 })}
          >
            −
          </button>
          <strong aria-live="polite">{s.spies ?? "–"}</strong>
          <button
            type="button"
            class="secondary"
            aria-label={t.moreSpies}
            disabled={disabled}
            onClick={() => change({ kind: "spies", delta: 1 })}
          >
            +
          </button>
        </div>
      </div>
      <div class="row between">
        <span>{t.mrWhite}</span>
        <button
          type="button"
          class={s.white ? "chip on" : "chip"}
          aria-pressed={Boolean(s.white)}
          disabled={disabled}
          onClick={() => change({ kind: "white" })}
        >
          {s.white ? `✅ ${t.on}` : `⬜ ${t.off}`}
        </button>
      </div>
      <div class="row between">
        <span class="muted small">{s.auto ? t.autoCounts : ""}</span>
        {!s.auto && (
          <button type="button" class="link small" disabled={disabled} onClick={() => change({ kind: "auto" })}>
            {t.resetAuto}
          </button>
        )}
      </div>
      {s.problem === "civilians_not_majority" && (
        <p class="error small" role="alert">
          ⚠️ {t.badCounts}
        </p>
      )}
      <div>
        <p class="muted small">{t.timers}</p>
        <div class="chips">
          {(["discussion", "vote"] as const).map((timer) => (
            <button
              key={timer}
              type="button"
              class={s.timers[timer] ? "chip on" : "chip"}
              disabled={disabled}
              onClick={() => change({ kind: "timer", timer })}
            >
              ⏱ {timer === "discussion" ? t.discussionTimer : t.voteTimer}: {t.minutes(s.timers[timer])}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p class="muted small">{t.themes}</p>
        <div class="chips">
          {s.themes.map((th) => (
            <button
              key={th.id}
              type="button"
              class={th.on ? "chip on" : "chip"}
              aria-pressed={th.on}
              disabled={disabled}
              onClick={() => change({ kind: "theme", theme: th.id })}
            >
              {th.on ? "✅" : "⬜"} {th.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
