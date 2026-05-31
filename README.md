# 8bitMinter

8bitMinter is a retro-styled Farcaster Mini App for creating Base/Zora tokens with AI-assisted metadata, visuals, and token detail pages.

The existing codebase shares several ideas with VisionZ-style AI coin tooling, but this README documents the project as 8bitMinter: a compact token creator with pixel UI, Farcaster distribution, and Zora coin infrastructure.

## What It Does

- Guides a creator through token name, symbol, image, description, and launch configuration.
- Uses AI services to assist with token concept, copy, and visuals.
- Creates token/coin experiences through Zora SDK and Base wallet flows.
- Displays token details, score/rating style analysis, comments, and on-chain context.
- Optimizes the interface for Farcaster Mini App usage on mobile.

## The Problem It Solves

Creating a token normally requires switching between image tools, metadata editors, wallet flows, contract tooling, and social sharing. 8bitMinter compresses that into one creator-facing mini app.

## App Pages & Features

| Screen | Purpose |
| --- | --- |
| Create | Token concept, metadata, media, and launch flow. |
| Details | Token profile, score/rating context, comments, and market/on-chain data. |
| Explore | Created tokens and discovery-oriented views. |
| Farcaster surface | Mobile-ready sharing and mini app context. |

## Enhanced Token Details & Analysis

- Token score and rating system for quick evaluation.
- Multi-tab detail interface for overview, market, comments, and technical context.
- AI services integration for generated descriptions, images, and analysis copy.
- On-chain data integration through wallet and Zora-related libraries.

| Layer | Tools |
| --- | --- |
| Frontend | Next.js, TypeScript, Tailwind CSS, VT323, Press Start 2P, Radix UI |
| Farcaster | Farcaster auth, frame packages, Mini App SDK |
| AI/Data | Google Gemini, Supabase, Upstash Redis |
| Web3 | Zora SDK, Zora Protocol SDK, Wagmi, Viem, Ethers, Base |

## Repository Structure

- `src/` - app routes, components, token flows, AI/Web3 integrations, and API code.
- `public/` - static assets, icons, and mini app metadata.
- `next.config.js` and `vercel.json` - framework and deployment configuration.

## Development

```bash
npm install
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development. |
| `npm run build` | Build for production. |
| `npm start` | Run production build. |
| `npm run lint` | Run lint checks. |

## What Is Next

- Improve token scoring signals.
- Expand Farcaster sharing and discovery mechanics.
- Harden launch flow validation and media handling.

## Status

- Repository: https://github.com/yusufky63/8bitminter
- Live app: https://8bitminter.vercel.app
