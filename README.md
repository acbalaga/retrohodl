# retrohodl.xyz

A static, no-backend calculator site with three tabs: DCA Plan, Break-even and Drawdown. It does arithmetic on numbers you type in. No API calls, no analytics, no cookies, no browser storage. Shareable state lives in URL query params only. Full spec: [PLAN.md](PLAN.md).

## Develop

```bash
nvm use            # Node 22.23.4 (.nvmrc)
npm install
npm run dev        # local dev server
npm test           # Vitest (calc, parse, format, url-state)
npm run build      # copy check + tests + astro check + build, outputs to dist/
npm run preview    # serve dist/
```

`npm run images` re-renders `og.png`, `apple-touch-icon.png` and `favicon-32.png` from the SVG sources (outputs are committed).

## Deploy

See [DEPLOY.md](DEPLOY.md) for the Cloudflare Pages settings and the custom-domain steps.

## Out of scope for v1

Price APIs or runtime network requests, wallet or exchange connections, accounts and saved plans, analytics and cookies, any browser storage, FX conversion, charts, tax lots, staking yield, variable buy amounts, light theme, locale-aware number entry, and any text that predicts prices or suggests actions.
