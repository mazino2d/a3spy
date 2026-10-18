import { DurableObject } from "cloudflare:workers";
import { Api, GrammyError } from "grammy";
import { msg } from "../bot/messages";
import type { Env } from "../env";

/**
 * Everyone who has used the bot, and the owner's announcements to them (M7 B1). One
 * instance, named "bot". Holds Telegram user ids and the announcement being sent; no game
 * data. It was filled before the game moved to the web and kept through that cutover.
 */

/** Messages per alarm: under the free plan's 50 subrequests and Telegram's ~30 messages/s. */
export const BATCH = 20;
/** Telegram's limit for one message. */
export const TEXT_MAX = 4096;

interface Pending {
  id: string;
  text: string;
}

interface Job {
  id: string;
  text: string;
  owner: number;
  queue: number[];
  sent: number;
  failed: number;
}

export type StartOutcome = "started" | "stale" | "busy";

const users = (storage: DurableObjectState["storage"]) =>
  [...storage.kv.list<number>({ prefix: "u:" })].map(([key]) => Number(key.slice(2)));

export class AudienceDO extends DurableObject<Env> {
  /** Adds a Telegram user who started or messaged the bot; once per user. */
  add(id: number): void {
    if (this.ctx.storage.kv.get(`u:${id}`) === undefined) this.ctx.storage.kv.put(`u:${id}`, 1);
  }

  count(): number {
    return users(this.ctx.storage).length;
  }

  /** Stores the one announcement waiting for the owner's confirmation; a newer one replaces it. */
  prepare(text: string): { id: string; count: number } {
    const id = crypto.randomUUID().slice(0, 8);
    this.ctx.storage.kv.put<Pending>("pending", { id, text });
    return { id, count: this.count() };
  }

  cancel(id: string): boolean {
    if (this.ctx.storage.kv.get<Pending>("pending")?.id !== id) return false;
    this.ctx.storage.kv.delete("pending");
    return true;
  }

  /** Starts sending the confirmed announcement in batches; refuses an outdated preview. */
  async start(id: string, owner: number): Promise<StartOutcome> {
    const pending = this.ctx.storage.kv.get<Pending>("pending");
    if (pending?.id !== id) return "stale";
    if (this.ctx.storage.kv.get<Job>("job")) return "busy";
    this.ctx.storage.kv.put<Job>("job", { ...pending, owner, queue: users(this.ctx.storage), sent: 0, failed: 0 });
    this.ctx.storage.kv.delete("pending");
    await this.ctx.storage.setAlarm(Date.now());
    return "started";
  }

  /** Sends one batch. Progress is saved before sending, so a retried alarm never sends twice. */
  async alarm(): Promise<void> {
    const job = this.ctx.storage.kv.get<Job>("job");
    if (!job) return;
    const batch = job.queue.slice(0, BATCH);
    const next: Job = { ...job, queue: job.queue.slice(BATCH) };
    this.ctx.storage.kv.put("job", next);

    const api = new Api(this.env.TELEGRAM_BOT_TOKEN);
    const results = await Promise.all(
      batch.map(async (chat) => {
        try {
          await api.sendMessage(chat, job.text);
          return true;
        } catch (err) {
          // Blocked the bot or deleted the account: stop sending to them.
          if (err instanceof GrammyError && (err.error_code === 403 || err.error_code === 400))
            this.ctx.storage.kv.delete(`u:${chat}`);
          console.warn("announcement failed", { chat, error: String(err) });
          return false;
        }
      }),
    );
    next.sent += results.filter(Boolean).length;
    next.failed += results.filter((ok) => !ok).length;

    if (next.queue.length) {
      this.ctx.storage.kv.put("job", next);
      await this.ctx.storage.setAlarm(Date.now() + 1000);
      return;
    }
    this.ctx.storage.kv.delete("job");
    await api.sendMessage(next.owner, msg.announceDone(next.sent, next.failed)).catch(() => {});
  }
}

export const audienceOf = (env: Env) => env.AUDIENCE.getByName("bot");
