import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TELEGRAM_BOT_TOKEN: "123456:test-token",
          TELEGRAM_WEBHOOK_SECRET: "test-webhook-secret",
          REALTIME_APP_TOKEN: "test-realtime-token",
        },
      },
    }),
  ],
});
