# MemSync

MemSync is a Bun-powered Turborepo monorepo with:

- `apps/web`: Next.js app for marketing, Clerk auth, Polar billing, and extension token management
- `apps/extension`: MV3 browser extension for Claude and ChatGPT memory sync
- `packages/ui`: shared shadcn-style UI package
- `packages/db`: shared Drizzle/DB package
- `packages/shared`: shared constants and types

## Commands

```bash
bun install
bun run dev
bun run dev:web
bun run check-types
bun run build
bun run build:web
bun run build:extension
```

## Environment

Copy the root env example and fill it in:

- `.env.example`

All apps and packages inherit from the root `.env` when run through Bun/Turbo from the repository root.

## Notes

- The old root Bun app has been retired. Runtime code now lives only in `apps/*` and `packages/*`.
- Clerk handles identity in the web app.
- Polar handles B2C billing.
- The extension authenticates with a first-party token generated in the web app.
