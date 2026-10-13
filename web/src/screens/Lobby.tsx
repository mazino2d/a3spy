import { useMemo, useState } from "preact/hooks";
import { renderSVG } from "uqr";
import { t } from "../messages";
import type { RoomProps } from "./Room";
import { Settings } from "./Settings";

export function Lobby({ view, links, online, send }: RoomProps) {
  const [copied, setCopied] = useState(false);
  const qr = useMemo(() => renderSVG(links.web, { border: 2, whiteColor: "#fff", blackColor: "#1E1B4B" }), [links.web]);
  const isHost = view.me === view.hostId;
  const enough = view.players.length + view.waiting.length >= 3;

  const share = async () => {
    const data = { title: t.shareTitle, text: t.shareText(view.code), url: links.web };
    try {
      if (navigator.share) return await navigator.share(data);
      await navigator.clipboard.writeText(links.web);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The player closed the share sheet.
    }
  };

  return (
    <main class="screen">
      <header class="row between">
        <h1>{t.room(view.code)}</h1>
        <button type="button" class="link small" onClick={() => send({ type: "command", action: "leave" })}>
          {t.leave}
        </button>
      </header>

      <section class="card center">
        {/* Generated locally from the room link; no user content inside. */}
        <div class="qr" role="img" aria-label={t.scanToJoin} dangerouslySetInnerHTML={{ __html: qr }} />
        <p class="muted small">{t.scanToJoin}</p>
        <button type="button" class="secondary" onClick={share}>
          {copied ? t.copied : t.share}
        </button>
        <p class="muted small">
          {t.telegramToo}{" "}
          <a class="link" href={links.telegram} target="_blank" rel="noopener">
            {links.telegram.replace("https://", "")}
          </a>
        </p>
      </section>

      <section>
        <h2>{t.players(view.players.length)}</h2>
        <ol class="players">
          {view.players.map((p) => (
            <li key={p.id} class={p.id === view.me ? "me" : undefined}>
              {p.name}
              {p.id === view.hostId && " 👑"}
              {p.id === view.me && <span class="muted"> ({t.you})</span>}
            </li>
          ))}
        </ol>
        {view.waiting.length > 0 && (
          <>
            <h2>{t.waiting(view.waiting.length)}</h2>
            <ul class="players">
              {view.waiting.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      {isHost ? (
        <Settings
          view={view}
          online={online}
          change={(change) => send({ type: "command", action: "configure", change })}
        />
      ) : (
        <Settings view={view} online={online} />
      )}

      <footer class="actions">
        {isHost ? (
          <>
            <p class="muted small center-text">{enough ? t.readyToStart : t.needMore}</p>
            <button
              type="button"
              class="primary big"
              disabled={!online || !enough}
              onClick={() => send({ type: "command", action: "start" })}
            >
              {t.start}
            </button>
          </>
        ) : (
          <p class="muted center-text">{t.waitHost}</p>
        )}
      </footer>
    </main>
  );
}
