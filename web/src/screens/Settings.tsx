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
  const allOn = themesOn.length === s.themes.length;
  const themesText = allOn
    ? t.allThemesCount(s.themes.length)
    : themesOn.length <= 4
      ? themesOn.map((th) => `${th.emoji} ${th.name}`).join(", ")
      : t.someThemes(themesOn.length, s.themes.length, themesOn.map((th) => th.emoji).join(" "));

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
        {s.voice && <p class="muted small">{t.voiceSummary}</p>}
      </section>
    );

  const disabled = !online;
  return (
    <section class="card stack">
      <h2>{t.settings}</h2>
      <p class="group">{t.groupRoles}</p>
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
        <Toggle on={Boolean(s.white)} label={t.mrWhite} disabled={disabled} onClick={() => change({ kind: "white" })} />
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
        <p class="group">{t.groupPace}</p>
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
      <div class="row between">
        <span>
          <span class="group">{t.voice}</span>
          <br />
          <span class="muted small">{t.voiceHint}</span>
        </span>
        <Toggle on={s.voice} label={t.voice} disabled={disabled} onClick={() => change({ kind: "voice" })} />
      </div>
      <details class="themes">
        <summary>
          <span>
            📚 {t.themes} ({themesOn.length}/{s.themes.length})
          </span>
          <span class="muted small">{themesText}</span>
        </summary>
        <div class="row between">
          <span class="muted small">{t.themesHint}</span>
          {!allOn && (
            <button type="button" class="link small" disabled={disabled} onClick={() => change({ kind: "allThemes" })}>
              {t.allThemesOn}
            </button>
          )}
        </div>
        <div class="theme-grid">
          {s.themes.map((th) => (
            <button
              key={th.id}
              type="button"
              class={th.on ? "theme-chip on" : "theme-chip"}
              aria-pressed={th.on}
              disabled={disabled}
              onClick={() => change({ kind: "theme", theme: th.id })}
            >
              <span class="emoji" aria-hidden="true">
                {th.emoji}
              </span>
              <span>{th.name}</span>
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}

/** The one on/off control in the settings (M8 U5): a switch that also says Có / Không. */
function Toggle({ on, label, disabled, onClick }: { on: boolean; label: string; disabled: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      class={on ? "toggle on" : "toggle"}
      disabled={disabled}
      onClick={onClick}
    >
      <span class="knob" aria-hidden="true" />
      {on ? t.on : t.off}
    </button>
  );
}
