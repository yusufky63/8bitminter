# 8bitMinter

8bitMinter is a retro-styled token creator for Farcaster and Base. It uses AI-assisted content, Zora SDK flows, and a mobile-first minting experience.

## Snapshot

- **Category:** Retro Farcaster token creator
- **Status:** Public repository
- **Live:** https://8bitminter.vercel.app
- **Repository:** https://github.com/yusufky63/8bitminter
- **Portfolio:** https://codexsha.dev

## Product Scope

8bitMinter is documented here as a product repository, not just a code dump. The goal of this README is to make the product purpose, runtime surface, and development path clear for future review and maintenance.

## Core Capabilities

- Retro token creation interface
- AI-assisted token copy and visual generation
- Zora coin creation flow
- Farcaster-ready mobile UX
- Supabase/Redis-backed product flow where enabled

## Existing README Coverage Preserved

This refresh keeps the important project-specific areas from the previous documentation:

- What it does
- The problem it solves
- Challenges I ran into
- Technologies I used
- How we built it
- What we learned
- What's next
- App Pages & Features

## Tech Stack

- Next.js
- TypeScript
- Farcaster SDK
- Zora SDK
- Google Gemini
- Supabase
- Upstash Redis
- Ethers
- Wagmi
- Viem

## Repository Map

| Path | Purpose |
| --- | --- |
| src/app/ | App routes and mini app pages |
| src/components/ | Creation and wallet UI |
| src/lib/ | AI, Web3, and persistence helpers |
| public/ | Logo, splash, and preview assets |

## Local Development

| Command | Purpose |
| --- | --- |
| npm run dev | Run development server |
| npm run build | Build production app |
| npm run start | Start production server |
| npm run lint | Run lint checks |

## Environment Notes

Use local environment files for secrets and deployment-specific values. Do not commit real keys.

- Farcaster app credentials
- Zora/WalletConnect configuration
- AI provider keys
- Supabase credentials
- Upstash Redis credentials

## Operational Notes

- Keep this README aligned with the live product and portfolio copy.
- Prefer small, documented changes over large undocumented rewrites.
- The older README mixed hackathon-style story sections with implementation notes. This version keeps the useful story but makes the repo easier to scan.

## Maintainer

Built by Yusuf / Codexsha.

- GitHub: https://github.com/yusufky63
- X: https://x.com/codexsha
- Telegram: https://t.me/codexsha
