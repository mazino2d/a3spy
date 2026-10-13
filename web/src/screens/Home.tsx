import { useState } from "preact/hooks";
import { ApiError, createRoom, type Me } from "../api";
import { t } from "../messages";
import { cleanCode, go } from "../route";
import { recall, remember } from "../storage";

const isIosSafari = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !("standalone" in navigator && (navigator as { standalone?: boolean }).standalone);

export function Home({ me }: { me: Me }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(() => isIosSafari() && recall("a3spy.iosHint") !== "off");

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom();
      go({ name: "room", code: room.code });
    } catch (e) {
      if (e instanceof ApiError && e.room) go({ name: "room", code: e.room });
      else setError(t.network);
    } finally {
      setBusy(false);
    }
  };

  const join = (e: Event) => {
    e.preventDefault();
    const clean = cleanCode(code);
    if (!clean) return setError(t.roomNotFound);
    go({ name: "room", code: clean });
  };

  return (
    <main class="screen">
      <header class="row between">
        <h1>{t.hello(me.name)}</h1>
        <a class="link small" href="/?name">
          {t.changeName}
        </a>
      </header>
      <div class="stack">
        <button type="button" class="primary big" disabled={busy} onClick={create}>
          {t.createRoom}
        </button>
        <p class="muted center-text">{t.orJoin}</p>
        <form class="row" onSubmit={join}>
          <input
            class="code"
            aria-label={t.codePlaceholder}
            placeholder={t.codePlaceholder}
            autoCapitalize="characters"
            autoComplete="off"
            enterKeyHint="go"
            maxLength={4}
            value={code}
            onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
          />
          <button type="submit" class="secondary">
            {t.join}
          </button>
        </form>
        {error && (
          <p class="error" role="alert">
            {error}
          </p>
        )}
        <button type="button" class="secondary" onClick={() => go({ name: "stats" })}>
          {t.stats}
        </button>
      </div>
      {hint && (
        <aside class="hint row between">
          <span>{t.iosInstall}</span>
          <button
            type="button"
            class="link"
            onClick={() => {
              remember("a3spy.iosHint", "off");
              setHint(false);
            }}
          >
            {t.dismiss}
          </button>
        </aside>
      )}
    </main>
  );
}
