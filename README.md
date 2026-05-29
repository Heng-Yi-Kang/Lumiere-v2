<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0404e69d-f501-4d71-9db0-c0aebf0177f4

## Run Locally

**Prerequisites:** Node.js and pnpm via Corepack.

1. From `frontend/`, install dependencies:
   `pnpm install --frozen-lockfile`
2. Set the `GEMINI_API_KEY` in [.env.local](frontend/.env.local) to your Gemini API key
3. Run the app:
   `pnpm dev`
4. Optional workflow commands:
   `pnpm lint`, `pnpm typecheck`, `pnpm check`, `pnpm build`, `pnpm preview`, `pnpm clean`

If Corepack is not already enabled on your machine, run:
`corepack enable`
