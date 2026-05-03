# AGENTS.md

## Stack And Workflow
- Use Bun for everything in this repo. Prefer `bun install`, `bun run <script>`, and `bun --filter <workspace> run <script>`.
- This is a Turborepo monorepo. The active runtime code lives under `apps/*` and `packages/*` only.
- Do not reintroduce a root app shell or a duplicate root `src/` tree.
- Environment variables are defined once at the repo root. Use the root `.env` / `.env.example`, not per-app copies.

## Verified Commands
- Install: `bun install`
- Full dev: `bun run dev`
- Web-only dev: `bun run dev:web`
- Full build: `bun run build`
- Web-only build: `bun run build:web`
- Extension-only build: `bun run build:extension`
- Typecheck: `bun run check-types`

## Architecture
- Web app: `apps/web` using Next.js App Router.
- Browser extension: `apps/extension` using a Bun build for MV3.
- Shared UI: `packages/ui`.
- Shared DB: `packages/db`.
- Shared constants/types: `packages/shared`.

## Web Notes
- Clerk is used for app authentication in `apps/web`.
- Polar is used for B2C billing in `apps/web`.
- Extension token generation and verification routes live in `apps/web/app/api/extension/*`.
- `apps/web/proxy.ts` is the auth boundary for protected routes.

## Extension Notes
- The extension only targets `https://claude.ai/*` and `https://chatgpt.com/*`. Provider detection is hard-coded in `apps/extension/src/lib/providers.ts`.
- Extension UI bootstraps from `apps/extension/src/content.tsx`, injects `page-bridge.js`, and mounts a fixed-position root in the page.
- Shared extension cache key is `memsync.cache.v1` and auth key is `memsync.auth.v1` in `chrome.storage.local`; shape is defined in `apps/extension/src/lib/storage.ts`.
- If you change extension messaging or provider data flow, check both `apps/extension/src/content.tsx` and `apps/extension/src/page-bridge.ts` together.

## Conventions That Matter
- `packages/ui` is the canonical shadcn target.
- `packages/db` is server-only and should not be imported from client components.
- `apps/extension/dist/` and `apps/web/.next/` are build artifacts, not source.
- Root `package.json` should stay focused on workspace orchestration, not app runtime dependencies.

## Verification
- There is no repo-local CI or test suite configured yet; do not invent one in `AGENTS.md`.
- For web changes, the smallest real verification is usually `bun run build:web` or `bun run dev:web`.
- For extension changes, use `bun run build:extension` and verify the output in `apps/extension/dist/`.
- For cross-workspace changes, use `bun run check-types` and `bun run build`.
