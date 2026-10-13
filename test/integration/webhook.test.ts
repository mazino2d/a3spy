import { SELF } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-webhook-secret";

const startUpdate = {
  update_id: 1,
  message: {
    message_id: 1,
    date: 0,
    chat: { id: 1001, type: "private", first_name: "Khôi" },
    from: { id: 1001, is_bot: false, first_name: "Khôi" },
    text: "/start",
    entities: [{ type: "bot_command", offset: 0, length: 6 }],
  },
};

function telegramStub() {
  const calls: { method: string; body: Record<string, unknown> }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = url.split("/").pop() ?? "";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ method, body });
    const result =
      method === "getMe"
        ? {
            id: 42,
            is_bot: true,
            first_name: "A3 Spy",
            username: "a3spy_bot",
            can_join_groups: false,
            can_read_all_group_messages: false,
            supports_inline_queries: false,
          }
        : {
            message_id: 2,
            date: 0,
            chat: { id: body.chat_id, type: "private" },
          };
    return Response.json({ ok: true, result });
  });
  return calls;
}

const post = (body: unknown, secret?: string) =>
  SELF.fetch("https://a3spy.test/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}),
    },
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("webhook", () => {
  it("rejects requests without the Telegram secret header", async () => {
    const calls = telegramStub();
    const res = await post(startUpdate);
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("rejects requests with a wrong secret", async () => {
    const calls = telegramStub();
    const res = await post(startUpdate, "wrong");
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("answers /start in a private chat", async () => {
    const calls = telegramStub();
    const res = await post(startUpdate, SECRET);

    expect(res.status).toBe(200);
    const sent = calls.filter((c) => c.method === "sendMessage");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body.chat_id).toBe(1001);
    expect(String(sent[0]?.body.text)).toContain("A3 Spy");
  });
});

describe("routing", () => {
  it("serves a health check", async () => {
    const res = await SELF.fetch("https://a3spy.test/healthz");
    expect(await res.text()).toBe("ok");
  });

  it("returns 404 for unknown paths", async () => {
    const res = await SELF.fetch("https://a3spy.test/nope");
    expect(res.status).toBe(404);
  });
});
