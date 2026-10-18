import { useEffect, useState } from "preact/hooks";
import { t } from "../messages";
import { go } from "../route";

/**
 * The rules in one phone screen (M8 U8): public, no name or room needed, meant to be sent to
 * friends. "Chơi ngay" opens the app; from inside a room, "Quay lại" goes back to it.
 */
export function Rules() {
  const [copied, setCopied] = useState(false);
  const fromApp = (history.state as { fromApp?: boolean } | null)?.fromApp === true;

  useEffect(() => {
    const before = document.title;
    document.title = t.rulesTitleTag;
    return () => {
      document.title = before;
    };
  }, []);

  const share = async () => {
    const url = `${location.origin}/luat`;
    try {
      if (navigator.share) return await navigator.share({ title: t.rulesTitleTag, text: t.rulesShareText, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The player closed the share sheet.
    }
  };

  return (
    <main class="screen rules">
      <header class="row between">
        <h1>{t.rulesTitle}</h1>
        {fromApp && (
          <button type="button" class="link small" onClick={() => history.back()}>
            {t.back}
          </button>
        )}
      </header>
      <p>{t.rulesIntro}</p>
      <section class="card">
        <h2>{t.rulesRolesTitle}</h2>
        <ul class="plain">
          {t.rulesRoles.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section class="card">
        <h2>{t.rulesRoundTitle}</h2>
        <ol class="players">
          {t.rulesRound.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
      <section class="card">
        <h2>{t.rulesWinTitle}</h2>
        <ul class="plain">
          {t.rulesWin.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p class="muted small">{t.rulesVoice}</p>
      </section>
      <footer class="actions">
        <button type="button" class="primary big" onClick={() => go({ name: "home" })}>
          {t.playNow}
        </button>
        <button type="button" class="secondary" onClick={share}>
          {copied ? t.copied : t.rulesShare}
        </button>
      </footer>
    </main>
  );
}
