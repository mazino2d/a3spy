import { useMemo, useState } from "preact/hooks";
import { renderSVG } from "uqr";
import { t } from "../messages";
import type { RoomProps } from "./Room";
import { Settings } from "./Settings";

export function Lobby({ view, links, online, send, mark }: RoomProps) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const qr = useMemo(() => renderSVG(links.web, { border: 2, whiteColor: "#fff", blackColor: "#2B241A" }), [links.web]);
  const isHost = view.me === view.hostId;
  const enough = view.players.length + view.waiting.length >= 3;

  const flash = (what: "link" | "code") => {
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };
  const share = async () => {
    const data = { title: t.shareTitle, text: t.shareText(view.code), url: links.web };
    try {
      if (navigator.share) return await navigator.share(data);
      await navigator.clipboard.writeText(links.web);
      flash("link");
    } catch {
      // The player closed the share sheet.
    }
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(view.code);
      flash("code");
    } catch {
      // Clipboard blocked: the code is on screen to copy by hand.
    }
  };

  return (
    <main class="screen">
      <header class="row between">
        <h1>{t.lobbyTitle}</h1>
        <button type="button" class="link small" onClick={() => send({ type: "command", action: "leave" })}>
          {t.leave}
        </button>
      </header>

      {/* Share first: most rooms are online, so a link or the code beats a QR code (M8 U1). */}
      <section class="card">
        <div class="row between">
          <div>
            <p class="muted small">{t.roomCode}</p>
            <p class="room-code">{view.code}</p>
          </div>
          <button type="button" class="secondary" onClick={copyCode}>
            {copied === "code" ? t.codeCopied : t.copyCode}
          </button>
        </div>
        <button type="button" class="secondary" onClick={share}>
          {copied === "link" ? t.copied : t.share}
        </button>
        <details class="qr-fold" open={!view.settings.voice}>
          <summary class="qr-toggle">{t.showQr}</summary>
          {/* Generated locally from the room link; no user content inside. */}
          <div class="qr" role="img" aria-label={t.scanToJoin} dangerouslySetInnerHTML={{ __html: qr }} />
          <p class="muted small">{t.scanToJoin}</p>
        </details>
      </section>

      <section>
        <h2>{t.players(view.players.length)}</h2>
        <ol class="players">
          {view.players.map((p) => (
            <li key={p.id} class={p.id === view.me ? "me" : undefined}>
              {p.name}
              {p.id === view.hostId && " 👑"}
              {mark(p.id)}
              {p.id === view.me && <span class="muted"> ({t.you})</span>}
            </li>
          ))}
        </ol>
        {view.waiting.length > 0 && (
          <>
            <h2>{t.waiting(view.waiting.length)}</h2>
            <ul class="players">
              {view.waiting.map((p) => (
                <li key={p.id}>
                  {p.name}
                  {mark(p.id)}
                </li>
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

      <footer class={isHost ? "actions pinned" : "actions"}>
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
