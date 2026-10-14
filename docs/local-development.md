# Local development

Install dependencies with `npm ci`.

Large media files are gitignored and are not included in a checkout. To load
them from Cloudflare R2 locally, copy `.env.example` to `.env.local` and set:

```dotenv
VITE_MEDIA_URL=https://<your-public-media-host>
```

Use the public bucket URL or custom domain, including any asset prefix. Its
root should contain `audio/`, `images/`, `videos/`, and `3d/`; do not append
`public/`. This is public browser configuration, not an R2 API endpoint or
credential. The same setting applies to development and production builds.

Run `npm run dev` and open the URL Vite prints. Restart the server after
changing `.env.local`. For a production preview, run `npm run build` followed
by `npm run preview`; changing the media host requires rebuilding.

Without `VITE_MEDIA_URL`, the app requests media from the local `public/`
directory. This mode requires a separate local copy of those files.

## Troubleshooting media

- In browser Network tools, confirm audio, artwork, atmosphere video, and GLB
  requests use the configured media host. Local requests usually mean the
  variable is missing or the server was not restarted.
- A 404 from the media host means the requested object path is missing. R2
  object keys must match the requested path, including case.
- Cross-origin audio, JSON, and model requests require the R2 host to allow
  the local app origin through CORS. Use the actual origin printed by Vite
  (including its port). Audio streaming also needs working range responses.
- Instrument technique demonstrations currently use local test clips under
  `public/videos/instruments/`, independently of `VITE_MEDIA_URL`. See
  `src/features/instrument-explorer/technique.ts`; these clips are gitignored.

Fonts are committed and served from the app origin.
