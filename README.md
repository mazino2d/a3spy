# A3 Spy

Telegram bot that runs *Who is Spy* (Undercover rules) for friends playing in person: it deals secret words over DM, calls the speaking order, runs the vote and keeps score.

- Product spec: [PRD](https://claude.ai/code/artifact/b93c4b7f-b4e8-4628-846a-d2a864feb420) · rules: [docs/rules.md](docs/rules.md)
- Contributing (humans and AI agents): [AGENTS.md](AGENTS.md)

```bash
npm ci
npm run check   # lint + typecheck + tests
npm run dev     # local Worker; needs .dev.vars (see .dev.vars.example)
```

Runs on Cloudflare Workers. Merging to `main` deploys automatically; infra lives in [everything-as-code](https://github.com/mazino2d/everything-as-code).
