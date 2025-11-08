# Sandgraal's Retro Game List

WIP: A fast, private, and no-nonsense tracker for classic and retro games.

**Features:**
- Instantly search, sort, and filter a growing database of console classics
- Mark games as “owned” (stored locally in your browser for privacy)
- Share your collection with anyone via code—no registration required
- See box art, details, and direct links to gameplay videos or GameFAQs
- Fully mobile and desktop compatible

This is not another bloated ROM launcher or subscription service.
It’s a clean, modern tool for serious collectors, archivists, and retro fans who want control over their library.

---

## Getting Started

1. Copy `config.example.js` to `config.js` and paste in your Supabase project's URL and public anon key. Never commit the populated `config.js` file.
2. Serve the repository with any static web server (for example `python -m http.server 8080`) so Supabase requests originate from `http://localhost`.
3. Open the served `index.html` in your browser and start exploring.

If you would rather work offline against CSV data, update `app.js` to read from `games.csv` before loading the page.

---

## Roadmap

Upcoming features:
- **User Accounts:** Login support (opt-in, no forced registration)
- **Cloud Sync:** Option to sync your collection across devices
- **Personal notes, favorites, and wishlists**
- **Bulk CSV/game import tools**
- **Custom tagging and advanced stats**
- **Improved image management and gallery modes**

---

## Contributing

Suggestions, pull requests, and bug reports are welcome.  
If you want to add major features, open an issue first to coordinate.

---

## License

MIT. Use it, fork it, extend it. Attribution appreciated.

---

## Contact

Project by [Sandgraal](https://github.com/sandgraal).
Questions or feedback: [Open an Issue](https://github.com/sandgraal/retro_games/issues)

---

## Documentation

- [Current state overview](docs/current-state.md)
- [Implementation plan](docs/implementation-plan.md)
- [Repository context snapshot](context/context.md)