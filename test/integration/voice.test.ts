import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { realtimeStub } from "../helpers/realtime";
import { telegramStub } from "../helpers/telegram";
import { connect, createRoom, guest, joinRoom, type Socket } from "../helpers/web";

let rt: ReturnType<typeof realtimeStub>;

beforeEach(() => {
  telegramStub();
  rt = realtimeStub();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const toggleVoice = (s: Socket) => s.send({ type: "command", action: "configure", change: { kind: "voice" } });
const join = (s: Socket) => s.send({ type: "voice", op: "join", sdp: "offer-sdp", mid: "0" });

/** A host and a second player, both on the web, in one room with voice on. */
async function onlineRoom(names: [string, string]) {
  const [a, b] = [await guest(names[0]), await guest(names[1])];
  const code = await createRoom(a);
  await joinRoom(b, code);
  const [sa, sb] = [await connect(a, code), await connect(b, code)];
  await sa.next("voice");
  toggleVoice(sa);
  await sa.next("voice", (m) => m.on);
  await sb.next("voice", (m) => m.on);
  return { a, b, code, sa, sb };
}

describe("V1 V2 voice call on the web", () => {
  it("V1 AC1 a new room sends voice off and refuses to join a call", async () => {
    const a = await guest("Vy");
    const code = await createRoom(a);
    const sa = await connect(a, code);
    expect(await sa.next("voice")).toEqual({ type: "voice", on: false, members: [] });
    join(sa);
    expect(await sa.next("voiceError")).toEqual({ type: "voiceError", code: "voice_off" });
    expect(rt.calls).toEqual([]);
  });

  it("V2 AC6 joining publishes the microphone and everyone sees the new member", async () => {
    const { a, sa, sb } = await onlineRoom(["Vy", "Khoa"]);
    join(sa);
    expect(await sa.next("voiceSdp")).toEqual({
      type: "voiceSdp",
      sdp: { type: "answer", sdp: "answer-sdp" },
      tracks: [],
    });
    const seen = await sb.next("voice", (m) => m.members.length === 1);
    expect(seen.members).toEqual([{ id: a.id, name: "Vy", muted: false, key: expect.stringMatching(/^p\d+-/) }]);
    expect(rt.calls.map((c) => c.path)).toEqual(["/sessions/new", "/sessions/S1/tracks/new"]);
    expect(rt.calls[1]?.body).toMatchObject({ tracks: [{ location: "local", mid: "0" }] });
  });

  it("V2 AC6 a second member pulls the first one's track and answers the SFU's offer", async () => {
    const { a, sa, sb } = await onlineRoom(["Vy", "Khoa"]);
    join(sa);
    await sa.next("voiceSdp");
    join(sb);
    await sb.next("voiceSdp");
    const { members } = await sb.next("voice", (m) => m.members.length === 2);
    const first = members.find((m) => m.id === a.id);

    sb.send({ type: "voice", op: "pull", ids: [a.id] });
    const offer = await sb.next("voiceSdp", (m) => m.tracks.length > 0);
    expect(offer).toEqual({
      type: "voiceSdp",
      sdp: { type: "offer", sdp: "offer-sdp" },
      tracks: [{ id: a.id, key: first?.key, mid: expect.any(String) }],
    });
    expect(rt.calls.at(-1)).toMatchObject({
      path: "/sessions/S2/tracks/new",
      body: { tracks: [{ location: "remote", sessionId: "S1", trackName: first?.key }] },
    });

    sb.send({ type: "voice", op: "answer", sdp: "answer-from-b" });
    await vi.waitFor(() => expect(rt.calls.at(-1)?.path).toBe("/sessions/S2/renegotiate"));
    expect(rt.calls.at(-1)?.body).toEqual({ sessionDescription: { type: "answer", sdp: "answer-from-b" } });
  });

  it("V2 AC11 a device not in the call cannot pull anyone", async () => {
    const { a, sa, sb } = await onlineRoom(["Vy", "Khoa"]);
    join(sa);
    await sa.next("voiceSdp");
    sb.send({ type: "voice", op: "pull", ids: [a.id] });
    expect(await sb.next("voiceError")).toEqual({ type: "voiceError", code: "not_in_call" });
  });

  it("V3 AC14 muting shows the member as muted to everyone", async () => {
    const { a, sa, sb } = await onlineRoom(["Vy", "Khoa"]);
    join(sa);
    await sa.next("voiceSdp");
    sa.send({ type: "voice", op: "mute", muted: true });
    const { members } = await sb.next("voice", (m) => m.members[0]?.muted === true);
    expect(members).toEqual([expect.objectContaining({ id: a.id, muted: true })]);
  });

  it("V1 AC4 the host turning voice off empties the call for everyone", async () => {
    const { sa, sb } = await onlineRoom(["Vy", "Khoa"]);
    join(sb);
    await sb.next("voiceSdp");
    await sa.next("voice", (m) => m.members.length === 1);
    toggleVoice(sa);
    expect(await sb.next("voice", (m) => !m.on)).toEqual({ type: "voice", on: false, members: [] });
  });

  it("V5 AC21 leaving the call or the room takes the player out of it", async () => {
    const { sa, sb } = await onlineRoom(["Vy", "Khoa"]);
    join(sa);
    join(sb);
    await sa.next("voice", (m) => m.members.length === 2);
    sb.send({ type: "voice", op: "leave" });
    await sa.next("voice", (m) => m.members.length === 1);
    sa.send({ type: "command", action: "leave" });
    await sb.next("voice", (m) => m.members.length === 0);
  });

  it("V2 AC23 voice messages never carry a word or a role", async () => {
    const { sa, sb, code } = await onlineRoom(["Vy", "Khoa"]);
    await joinRoom(await guest("Linh"), code);
    join(sa);
    await sa.next("voiceSdp");
    sa.send({ type: "command", action: "start" });
    const { view } = await sb.next("state", (m) => m.view.game !== null);
    const word = view.game?.hand?.word;
    const voiceOnly = sb.messages.filter((m) => m.type.startsWith("voice"));
    expect(voiceOnly.length).toBeGreaterThan(0);
    if (word) expect(JSON.stringify(voiceOnly)).not.toContain(word);
    expect(JSON.stringify(voiceOnly)).not.toContain('"role"');
  });
});
