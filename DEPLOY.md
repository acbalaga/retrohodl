# Deploying retrohodl.xyz to Cloudflare

Two routes. Both serve `dist/` and both read `public/_headers` for the CSP and security headers.

## Route A: Workers (static assets), uses `wrangler.jsonc`

Workers & Pages > Create > Import a repository, then:

| Setting | Value |
|---|---|
| Repository | `acbalaga/retrohodl` |
| Production branch | `main` (an existing branch; the build fails at "Cloning" if the branch was deleted) |
| Root directory | `/` (blank). This is a folder path, not a branch name |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variable | `NODE_VERSION` = `22.12.0` |

`wrangler.jsonc` sets the worker name `retrohodl` and serves `./dist`, with `dist/404.html` for unknown paths. The `*.pages.dev` noindex rule in `_headers` does not apply to `*.workers.dev`; add the custom domain below and treat the workers.dev URL as private (or disable it in the Worker's Settings > Domains & Routes). Custom domain: Worker > Settings > Domains & Routes > Add > Custom domain > `retrohodl.xyz` (and `www.retrohodl.xyz` with the redirect rule below).

## Route B: Pages


### Project settings

| Setting | Value |
|---|---|
| Source | GitHub, repo `retrohodl`, production branch `main` |
| Framework preset | `Astro` (or `None`; the fields below are what matter) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (blank) |
| Build system version | v3 (latest) |
| Environment variable (Production and Preview) | `NODE_VERSION` = `22.12.0` |
| Preview deployments | Enabled for all non-production branches (`public/_headers` adds `X-Robots-Tag: noindex` on `*.pages.dev`) |
| Web Analytics | **Off.** Pages project > Metrics. Do not enable automatic setup; it injects a third-party beacon and the CSP would block it anyway |

The build runs the copy check and the Vitest suite first, so a failing test blocks the deploy.

### Custom domain

1. Pages project > Custom domains > Set up a domain > `retrohodl.xyz`. Follow the prompt to add the DNS record (automatic if the zone is on Cloudflare).
2. Add `www.retrohodl.xyz` the same way.
3. Cloudflare dashboard > Rules > Redirect Rules > create a rule: if hostname equals `www.retrohodl.xyz`, redirect to `https://retrohodl.xyz${http.request.uri.path}` with status 301 and **preserve query string** enabled (share links carry state in the query).
4. Wait for the certificate to become Active, then open `https://retrohodl.xyz/`.

## Verify after the first deploy

- Response headers include the CSP from `public/_headers` (`curl -sI https://retrohodl.xyz/`).
- `https://<project>.pages.dev/` returns `X-Robots-Tag: noindex`.
- The browser Network panel shows requests to `retrohodl.xyz` only.
- A share link opened in a private window reproduces the state.
- `https://retrohodl.xyz/robots.txt` and `/sitemap.xml` load.
