import { env, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { BATCH } from "../../src/audience/AudienceDO";
import { press, telegramStub, text } from "../helpers/telegram";

const OWNER = 777;
let tg: ReturnType<typeof telegramStub>;

beforeEach(() => {
  tg = telegramStub();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const audience = () => env.AUDIENCE.getByName("bot");
const ids = () =>
  runInDurableObject(audience(), (_, state) =>
    [...state.storage.kv.list({ prefix: "u:" })].map(([k]) => Number(k.slice(2))).sort((a, b) => a - b),
  );
/** Forget everyone, so each test starts from an empty list. */
const reset = () => runInDurableObject(audience(), (_, state) => state.storage.deleteAll());

/** Makes Telegram refuse messages to these chats, as when a user blocked the bot. */
function blocked(chats: number[]) {
  const fetchMock = globalThis.fetch as unknown as MockInstance<typeof fetch>;
  const inner = fetchMock.getMockImplementation();
  fetchMock.mockImplementation(async (input, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (String(input).endsWith("/sendMessage") && chats.includes(body.chat_id))
      return Response.json({ ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" });
    return (inner as typeof fetch)(input, init);
  });
}

const previewButton = (label: string, nth = -1) => {
  const b = tg
    .to(OWNER)
    .flatMap((m) => m.buttons)
    .filter((x) => x.text.includes(label))
    .at(nth);
  if (!b) throw new Error(`no "${label}" button`);
  return b.data;
};

/** Waits until the announcement is fully sent (the owner got the summary), nudging the alarm along. */
async function drain() {
  await vi.waitFor(
    async () => {
      await runDurableObjectAlarm(audience());
      expect(tg.last(OWNER)?.text).toMatch(/^📣 Đã gửi/);
    },
    { timeout: 5000, interval: 50 },
  );
}

describe("B1 owner announcements", () => {
  beforeEach(reset);

  it("B1 AC1 anyone who messages the bot joins the list once", async () => {
    await text(3101, "/start");
    await text(3101, "/help");
    await text(3102, "xin chào");
    expect(await ids()).toEqual([3101, 3102]);
  });

  it("B1 AC2 AC3 the owner previews, confirms, and everyone gets the exact text once", async () => {
    for (const id of [3201, 3202]) await text(id, "/start");
    await text(OWNER, "/announce A3 Spy <chuyển> sang web & vui hơn!");
    const preview = tg.last(OWNER);
    expect(preview?.text).toContain("sẽ gửi tới 3 người");
    expect(preview?.text).toContain("A3 Spy <chuyển> sang web & vui hơn!");
    expect(tg.to(3201).some((m) => m.text.includes("chuyển"))).toBe(false);

    await press(OWNER, previewButton("Gửi"));
    await drain();
    for (const id of [3201, 3202, OWNER])
      expect(tg.to(id).filter((m) => m.text === "A3 Spy <chuyển> sang web & vui hơn!")).toHaveLength(1);
    expect(tg.last(OWNER)?.text).toBe("📣 Đã gửi tới 3 người, lỗi 0.");
    // Sent as plain text: nothing to escape, nothing to break.
    const sent = tg.calls.find(
      (c) => c.method === "sendMessage" && c.body.chat_id === 3201 && String(c.body.text).includes("chuyển"),
    );
    expect(sent?.body.parse_mode).toBeUndefined();
  });

  it("B1 AC3 a long list goes out in batches, each recipient once", async () => {
    const many = Array.from({ length: BATCH + 5 }, (_, i) => 4000 + i);
    await runInDurableObject(audience(), (instance) => {
      for (const id of many) (instance as unknown as { add(id: number): void }).add(id);
    });
    await text(OWNER, "/announce Bộ từ mới!");
    await press(OWNER, previewButton("Gửi"));
    await drain();
    const sent = tg.messages().filter((m) => m.text === "Bộ từ mới!");
    expect(sent).toHaveLength(many.length + 1);
    expect(new Set(sent.map((m) => m.chat)).size).toBe(many.length + 1);
    expect(many.length).toBeGreaterThan(BATCH);
    expect(tg.last(OWNER)?.text).toBe(`📣 Đã gửi tới ${many.length + 1} người, lỗi 0.`);
  });

  it("B1 AC4 a user who blocked the bot is counted and removed", async () => {
    for (const id of [3401, 3402]) await text(id, "/start");
    blocked([3402]);
    await text(OWNER, "/announce Hello");
    await press(OWNER, previewButton("Gửi"));
    await drain();
    expect(tg.last(OWNER)?.text).toBe("📣 Đã gửi tới 2 người, lỗi 1.");
    expect(await ids()).toEqual([OWNER, 3401]);
  });

  it("B1 AC5 anyone else's /announce sends nothing", async () => {
    await text(3501, "/start");
    tg.reset();
    await text(3501, "/announce Hack");
    expect(tg.messages().some((m) => m.text.includes("Hack"))).toBe(false);
    expect(tg.to(OWNER)).toHaveLength(0);
  });

  it("B1 AC6 an older preview cannot be sent; cancel sends nothing", async () => {
    await text(3601, "/start");
    await text(OWNER, "/announce Bản một");
    const first = previewButton("Gửi");
    await text(OWNER, "/announce Bản hai");
    await press(OWNER, first);
    expect(tg.answers().at(-1)?.text).toContain("cũ rồi");
    await press(OWNER, previewButton("Huỷ"));
    expect(tg.answers().at(-1)?.text).toBe("Đã huỷ.");
    await runDurableObjectAlarm(audience());
    expect(tg.messages().some((m) => m.text === "Bản một" || m.text === "Bản hai")).toBe(false);
  });
});
