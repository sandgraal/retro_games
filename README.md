# Retro Game Site

WIP: A fast, private, and no-nonsense tracker for classic and retro games. A p[lce for retro gamers to get their fix.

**Features:**

- Instantly search, sort, and filter a growing database of console classics
- Mark games as “owned” (can be stored locally in your browser for privacy)
- Share your collection with anyone via code—no registration required
- See box art, details, and direct links to gameplay videos or GameFAQs
- Fully mobile and desktop compatible

This is not another bloated ROM launcher or subscription service.
It’s a clean, modern tool for serious collectors, archivists, and retro fans who want control over their library.

## Setup

1. Copy `config.example.js` to `config.js` and provide your Supabase project URL and anon key in the new file.
2. Ensure `config.js` is present in the project root; the frontend will read credentials from this file.
3. Serve the site locally with any static server, e.g. `python -m http.server 8080`.
