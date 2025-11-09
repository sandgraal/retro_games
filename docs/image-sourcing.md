# Game Cover Image Sourcing Guide

The Retro Games List frontend expects every game entry to provide an absolute image URL in the `cover` field. Follow these guidelines to curate, host, and maintain high-quality artwork for the catalogue.

## Recommended Sources

| Source                                     | Why it works well                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wikimedia Commons / Wikipedia**          | Broad coverage of retro titles with permissive CC or public-domain licenses. Matches the existing dataset, so dimensions and aspect ratios already look correct in the UI. |
| **Official press kits or publisher sites** | Offer high-resolution key art when licensing allows direct linking. Always confirm redistribution rights and prefer HTTPS links.                                           |
| **Your own Supabase Storage or CDN**       | Ideal when you want control over assets. Upload to a public bucket and copy the public/signed HTTPS URL into the dataset.                                                  |

## How to Populate Cover Art

1. **Update the seed data**  
   Add the desired image URL to the `Cover` column in `games.csv` (or whichever dataset you load into Supabase). The `npm run seed:generate` script mirrors this value into both the `games.cover_url` column and the `game_media` gallery table when reseeding.
2. **Maintain gallery entries**  
   If you manage additional screenshots, extend the CSV columns or append rows to `supabase/seed.sql` so that modal galleries stay in sync.
3. **Sync the offline fallback**
   When Supabase is disabled, the UI relies on `data/sample-games.json`. Mirror `cover` and `screenshots` entries there to keep local mode visually consistent.

## Automatic Wikipedia Fallback

When a game row ships without a `cover` URL, the client now tries to look up artwork via the Wikipedia REST API. The lookup runs after the first dataset load (and whenever new rows stream in) and, when successful, stores the discovered HTTPS image URL in `localStorage` so repeat visits render instantly. Failed lookups are cached for seven days to avoid hammering the API.

This best-effort backfill keeps empty cards from lingering during data entry, but it is not a licensing substitute: always prefer supplying explicit, vetted URLs in your seed data so that Supabase exports, offline mode, and SEO metadata stay deterministic.

## Hosting & Performance Tips

- Always use HTTPS URLs—mixed-content warnings will block `http://` links when the site is served over TLS. The `normalizeImageUrl` helper in `app.js` passes through secure URLs untouched and only rewrites relative paths.
- Serve self-hosted images from a cache-friendly endpoint (CDN or Supabase Storage with caching headers) to keep modal loads snappy.
- Store descriptive alt text in the dataset when possible; the modal auto-generates alt text from game names, but explicit descriptions improve accessibility.

## Licensing Reminders

Verify that every external asset you embed is licensed for redistribution. When in doubt, prefer Wikimedia images with clear attribution or host files you created yourself.
