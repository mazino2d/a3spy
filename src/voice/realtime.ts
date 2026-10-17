/**
 * Cloudflare Realtime SFU API (https://developers.cloudflare.com/realtime/sfu/https-api/).
 * Only the GameRoomDO calls it: the app token must never reach a browser.
 */

const BASE = "https://rtc.live.cloudflare.com/v1";

export interface Sdp {
  type: "offer" | "answer";
  sdp: string;
}

export interface RemoteTrack {
  sessionId: string;
  trackName: string;
}

interface ApiTrack {
  trackName?: string;
  mid?: string;
  errorCode?: string;
}

interface ApiResponse {
  errorCode?: string;
  errorDescription?: string;
  sessionId?: string;
  sessionDescription?: Sdp;
  requiresImmediateRenegotiation?: boolean;
  tracks?: ApiTrack[];
}

export class RealtimeError extends Error {}

export interface Realtime {
  newSession(): Promise<string>;
  /** Publishes the device's audio track; returns the SFU's answer to the device's offer. */
  push(sessionId: string, offer: Sdp, mid: string, trackName: string): Promise<Sdp>;
  /** Pulls other devices' tracks into a session; the SFU answers with an offer to renegotiate. */
  pull(sessionId: string, tracks: RemoteTrack[]): Promise<{ offer: Sdp | null; mids: Record<string, string> }>;
  renegotiate(sessionId: string, answer: Sdp): Promise<void>;
}

/** null when the app is not configured (local dev, tests without a token). */
export function realtime(env: { REALTIME_APP_ID?: string; REALTIME_APP_TOKEN?: string }): Realtime | null {
  const { REALTIME_APP_ID: appId, REALTIME_APP_TOKEN: token } = env;
  if (!appId || !token) return null;

  const call = async (method: "POST" | "PUT", path: string, body?: unknown): Promise<ApiResponse> => {
    const res = await fetch(`${BASE}/apps/${appId}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = (await res.json().catch(() => ({}))) as ApiResponse;
    if (!res.ok || json.errorCode) throw new RealtimeError(`${res.status} ${json.errorCode ?? ""} ${path}`.trim());
    return json;
  };

  return {
    async newSession() {
      const r = await call("POST", "/sessions/new");
      if (!r.sessionId) throw new RealtimeError("no sessionId");
      return r.sessionId;
    },
    async push(sessionId, offer, mid, trackName) {
      const r = await call("POST", `/sessions/${sessionId}/tracks/new`, {
        sessionDescription: offer,
        tracks: [{ location: "local", mid, trackName }],
      });
      const failed = r.tracks?.find((t) => t.errorCode);
      if (failed || r.sessionDescription?.type !== "answer")
        throw new RealtimeError(`push failed ${failed?.errorCode ?? ""}`);
      return r.sessionDescription;
    },
    async pull(sessionId, tracks) {
      const r = await call("POST", `/sessions/${sessionId}/tracks/new`, {
        tracks: tracks.map((t) => ({ location: "remote", sessionId: t.sessionId, trackName: t.trackName })),
      });
      const mids: Record<string, string> = {};
      for (const t of r.tracks ?? []) if (t.trackName && t.mid && !t.errorCode) mids[t.trackName] = t.mid;
      const offer = r.requiresImmediateRenegotiation && r.sessionDescription ? r.sessionDescription : null;
      return { offer, mids };
    },
    async renegotiate(sessionId, answer) {
      await call("PUT", `/sessions/${sessionId}/renegotiate`, { sessionDescription: answer });
    },
  };
}
