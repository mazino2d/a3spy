import { useEffect, useRef, useState } from "preact/hooks";
import { cleanName } from "../../../src/web/protocol";
import { saveName } from "../api";
import { t } from "../messages";

interface Props {
  initial: string;
  /** Room code the player is about to join, if they came from a room link. */
  joining: string | null;
  onDone(guest: { id: number; name: string }): void;
}

export function NameScreen({ initial, joining, onDone }: Props) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Typing a name is the only thing to do here.
  useEffect(() => input.current?.focus(), []);

  const submit = async (e: Event) => {
    e.preventDefault();
    const clean = cleanName(name);
    if (!clean) return setError(t.nameInvalid);
    setBusy(true);
    setError(null);
    try {
      const guest = await saveName(clean);
      if (location.search) history.replaceState(null, "", location.pathname);
      onDone(guest);
    } catch {
      setError(t.network);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="screen center">
      <img class="logo" src="/icons/icon-192.png" alt="" width={96} height={96} />
      <h1>{t.appName}</h1>
      <p class="muted">{t.tagline}</p>
      <form class="stack" onSubmit={submit}>
        <label for="name">{t.namePrompt}</label>
        <input
          id="name"
          ref={input}
          autoComplete="nickname"
          enterKeyHint="go"
          maxLength={40}
          placeholder={t.namePlaceholder}
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <p class={error ? "error" : "muted small"} role={error ? "alert" : undefined}>
          {error ?? t.nameHint}
        </p>
        <button type="submit" class="primary" disabled={busy}>
          {joining ? t.joinRoom(joining) : t.next}
        </button>
      </form>
    </main>
  );
}
