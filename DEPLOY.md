# Deploying retrohodl.xyz to Cloudflare

Two routes. Both serve `dist/` and both read `public/_headers` for the CSP and security headers. Route A (Workers static assets) is the one in production.

## Route A: Workers (static assets), uses `wrangler.jsonc`

Workers & Pages > Create > Import a repository, then:

| Setting | Value |
|---|---|
| Repository | `acbalaga/retrohodl` |
| Production branch | `main`. It must be a branch that still exists; the build fails at "Cloning" if it was deleted after a merge |
| Root directory | `/` (blank). This is a folder path, not a branch name |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variable | `NODE_VERSION` = `22.12.0` |

`wrangler.jsonc` (committed to the repo root) names the Worker `retrohodl` and serves `./dist`, with `dist/404.html` for unknown paths. It must be on `main` before the first deploy, otherwise the build passes and `wrangler deploy` fails. The Workers build flow has no "output directory" field; that setting lives in `wrangler.jsonc`.

The build runs the copy check, the Vitest suite and `astro check` first, so a failing test blocks the deploy.

### Custom domain (Workers)

1. Worker > Settings > Domains & Routes > Add > **Custom domain** > `retrohodl.xyz`. Use a Custom domain, not a Route. A Route pattern of `retrohodl.xyz/` (no `*`) only covers the root path.
2. Add `www.retrohodl.xyz` the same way.
3. Make sure the zone has no leftover `A`, `AAAA` or `CNAME` records for the apex or `www` pointing at a parking or forwarding host, and that any registrar "URL forwarding" or "parked page" feature is off. Delete them before adding the Custom domain, or the Custom domain can be blocked or only partly take effect.
4. Cloudflare dashboard > Rules > Redirect Rules: if hostname equals `www.retrohodl.xyz`, redirect to `https://retrohodl.xyz${http.request.uri.path}` with status 301 and **Preserve query string** on. Share links carry state in the query.
5. Wait for the certificate to show Active, then open `https://retrohodl.xyz/`.
6. The `*.workers.dev` URL is not covered by the `*.pages.dev` noindex rule in `_headers`. Disable it under Settings > Domains & Routes, or treat it as private.

### Web Analytics

Keep Cloudflare Web Analytics **off** (Analytics & Logs > Web Analytics, or the Worker's Metrics). With it on, Cloudflare injects `static.cloudflareinsights.com/beacon.min.js`. The CSP (`script-src 'self'`) blocks it, so nothing is sent and the site works, but the browser console shows a CSP error. Do not loosen the CSP to allow it; that would make the "no tracking" copy false.

## Route B: Pages

| Setting | Value |
|---|---|
| Source | GitHub, repo `retrohodl`, production branch `main` |
| Framework preset | `Astro` (or `None`; the fields below are what matter) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (blank) |
| Build system version | v3 (latest) |
| Environment variable (Production and Preview) | `NODE_VERSION` = `22.12.0` |
| Preview deployments | Enabled for non-production branches (`public/_headers` adds `X-Robots-Tag: noindex` on `*.pages.dev`) |
| Web Analytics | Off (see above) |

Custom domain: Pages project > Custom domains > Set up a domain, for `retrohodl.xyz` and `www.retrohodl.xyz`, then the redirect rule from step 4 above. The same leftover-DNS-records warning applies.

If the Pages "Connect to Git" form is hard to find, it sits under Workers & Pages > Create > Pages tab. The default Create flow leads to Workers.

## Caching

`public/_headers` sets `Cache-Control: no-cache` on `/`, `/index.html` and `/404.html` so browsers revalidate the HTML and pick up new hashed CSS and JS after a deploy. `/_astro/*` is `immutable` for a year because file names carry a content hash.

## Verify after a deploy

Run these from any machine that can reach the site:

```bash
for u in / /_astro/ /favicon.svg /og.png /robots.txt /licenses/fonts.txt; do echo "== $u"; curl -sSI https://retrohodl.xyz$u | grep -iE "^HTTP|content-type|location"; done
```

Get a real `/_astro/` file name from the page source (`/_astro/index.<hash>.css`) and request that instead of `/_astro/`.

- Every asset returns `200` with the right content type (`text/css`, `text/javascript`, `image/png`). A `307` or `text/html` for CSS or JS means another server is answering for the domain (see below).
- `curl -sI https://retrohodl.xyz/` shows the `content-security-policy` header with `connect-src 'none'`.
- `https://retrohodl.xyz/nope` returns `404`.
- `https://www.retrohodl.xyz/?cur=PHP` redirects to `https://retrohodl.xyz/?cur=PHP`.
- A share link opened in a private window reproduces the state.
- The Network panel shows requests to `retrohodl.xyz` only.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Build fails at **Cloning**, before install | The configured branch was deleted (for example a merged plan branch), or Root directory is set to a branch name. Set the branch to `main` and Root directory to `/` |
| Build passes, **Deploy** step fails | `wrangler.jsonc` is missing from the deployed branch. Merge it to `main` |
| Build fails on install or tests with an engine or version error | `NODE_VERSION` is not set. Set it to `22.12.0` for Production and Preview |
| Page loads **unstyled and nothing works**; CSS and JS return `307` or `404` | The domain is answered partly by another server. Signature: `/` is served by the Worker (has the CSP header) but `/_astro/*`, `/favicon.svg` and `robots.txt` come from a different server (nginx, an `x-service` header, an `AWSALB` cookie). Cause: leftover DNS records, a registrar parking or forwarding service, or a Worker Route that only matches `/`. Fix: use a Custom domain, delete the old `A`, `AAAA` and `CNAME` records, turn off registrar forwarding. Confirm the CSS URL returns CSS text |
| Console error about `cloudflareinsights.com/beacon.min.js` | Web Analytics is on. Turn it off; harmless otherwise |
