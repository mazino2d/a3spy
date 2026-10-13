import { SELF } from "cloudflare:test";
import { vi } from "vitest";

export const SECRET = "test-webhook-secret";

export interface Call {
  method: string;
  body: Record<string, unknown>;
}

export interface Sent {
  chat: number;
  text: string;
  buttons: { text: string; data: string }[];
  messageId: number;
}

/** Stubs api.telegram.org for the Worker and its Durable Objects; records every call. */
export function telegramStub() {
  const calls: Call[] = [];
  let nextId = 100;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith("https://api.telegram.org/")) throw new Error(`unexpected fetch ${url}`);
    const method = url.split("/").pop() ?? "";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ method, body });
    if (method === "getMe")
      return Response.json({
        ok: true,
        result: {
          id: 42,
          is_bot: true,
          first_name: "A3 Spy",
          username: "a3spy_bot",
          can_join_groups: false,
          can_read_all_group_messages: false,
          supports_inline_queries: false,
        },
      });
    if (method === "sendMessage" || method === "editMessageText")
      return Response.json({
        ok: true,
        result: {
          message_id: body.message_id ?? nextId++,
          date: 0,
          chat: { id: body.chat_id, type: "private" },
          text: body.text,
        },
      });
    return Response.json({ ok: true, result: true });
  });

  const messages = (): Sent[] =>
    calls
      .filter((c) => c.method === "sendMessage" || c.method === "editMessageText")
      .map((c) => ({
        chat: c.body.chat_id as number,
        text: String(c.body.text),
        messageId: (c.body.message_id as number) ?? 0,
        buttons: (
          (c.body.reply_markup as { inline_keyboard?: { text: string; callback_data: string }[][] })?.inline_keyboard ??
          []
        )
          .flat()
          .map((b) => ({ text: b.text, data: b.callback_data })),
      }));

  return {
    calls,
    messages,
    to: (chat: number) => messages().filter((m) => m.chat === chat),
    last: (chat: number) =>
      messages()
        .filter((m) => m.chat === chat)
        .at(-1),
    answers: () => calls.filter((c) => c.method === "answerCallbackQuery").map((c) => c.body),
    reset: () => calls.splice(0, calls.length),
  };
}

let updateId = 1;
const user = (id: number) => ({ id, is_bot: false, first_name: `User${id}` });

export function post(update: unknown, secret: string | undefined = SECRET) {
  return SELF.fetch("https://a3spy.test/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}) },
    body: JSON.stringify(update),
  });
}

export function text(from: number, body: string) {
  const command = body.startsWith("/") ? body.split(" ")[0]?.length : undefined;
  return post({
    update_id: updateId++,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: from, type: "private", first_name: `User${from}` },
      from: user(from),
      text: body,
      ...(command ? { entities: [{ type: "bot_command", offset: 0, length: command }] } : {}),
    },
  });
}

export function press(from: number, data: string) {
  return post({
    update_id: updateId++,
    callback_query: {
      id: String(updateId),
      from: user(from),
      chat_instance: "x",
      data,
      message: { message_id: 1, date: 0, chat: { id: from, type: "private" } },
    },
  });
}
