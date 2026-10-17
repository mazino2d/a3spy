import type { MockInstance } from "vitest";

export interface RealtimeCall {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
}

/**
 * Stubs the Realtime SFU API on top of an existing fetch stub (call telegramStub() first).
 * Sessions are S1, S2…; a push answers, a pull offers one mid per requested track.
 */
export function realtimeStub() {
  const calls: RealtimeCall[] = [];
  const fetchMock = globalThis.fetch as unknown as MockInstance<typeof fetch>;
  const telegram = fetchMock.getMockImplementation();
  let sessions = 0;
  let mids = 1;
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith("https://rtc.live.cloudflare.com/v1/")) {
      if (!telegram) throw new Error(`unexpected fetch ${url}`);
      return telegram(input, init);
    }
    const path = url.replace(/^https:\/\/rtc\.live\.cloudflare\.com\/v1\/apps\/[^/]+/, "");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method: init?.method ?? "GET", path, body });
    if (path === "/sessions/new") return Response.json({ sessionId: `S${++sessions}` });
    if (path.endsWith("/renegotiate")) return Response.json({});
    const tracks = (body?.tracks ?? []) as { location: string; trackName: string }[];
    if (tracks[0]?.location === "local")
      return Response.json({ sessionDescription: { type: "answer", sdp: "answer-sdp" }, tracks });
    return Response.json({
      requiresImmediateRenegotiation: true,
      sessionDescription: { type: "offer", sdp: "offer-sdp" },
      tracks: tracks.map((t) => ({ ...t, mid: String(mids++) })),
    });
  });
  return { calls };
}
