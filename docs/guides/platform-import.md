# Platform Import Feature

Import your existing game collections from Steam, Xbox, PlayStation, Nintendo, and popular game tracking services.

## Supported Platforms

### Direct API Integration

#### Steam

- **Method**: API lookup by Steam ID
- **Requirements**: Public Steam profile
- **Data imported**: Owned games, playtime
- **Setup**: Just enter your Steam ID or profile URL

**Accepted formats:**

- 64-bit Steam ID: `76561198012345678`
- Profile URL: `steamcommunity.com/profiles/76561198012345678`
- Vanity URL: `steamcommunity.com/id/yourname`
- Vanity name: `yourname`

### File-Based Imports

| Service              | Format | Export URL                                                       |
| -------------------- | ------ | ---------------------------------------------------------------- |
| **Backloggd**        | CSV    | [backloggd.com/settings](https://www.backloggd.com/settings/)    |
| **GG.deals**         | CSV    | [gg.deals/collection](https://gg.deals/collection/)              |
| **HowLongToBeat**    | JSON   | Manual export required                                           |
| **Grouvee**          | CSV    | [grouvee.com/user/export](https://www.grouvee.com/)              |
| **ExoPhase**         | CSV    | [exophase.com](https://www.exophase.com/)                        |
| **RAWG.io**          | JSON   | [rawg.io](https://rawg.io/)                                      |
| **PSNProfiles**      | CSV    | [psnprofiles.com](https://psnprofiles.com/)                      |
| **TrueAchievements** | CSV    | [trueachievements.com](https://www.trueachievements.com/)        |
| **Deku Deals**       | CSV    | [dekudeals.com/collection](https://www.dekudeals.com/collection) |
| **Generic CSV**      | CSV    | Any CSV with 'name' column                                       |

## How It Works

### 1. Select Import Source

Click the **Import** button in the dashboard to open the import modal. Choose your platform or service.

### 2. Provide Data

- **Steam**: Enter your Steam ID or profile URL
- **Other services**: Upload your exported CSV/JSON file

### 3. Review Matches

The system uses fuzzy matching to find games in our catalog:

- **High confidence (90%+)**: Exact or near-exact matches
- **Medium confidence (70-89%)**: Likely matches, review recommended
- **Low confidence (<70%)**: Possible matches, manual verification needed

You can select which games to import and choose alternative matches if available.

### 4. Import to Collection

Choose the default collection status (Owned, Backlog, or Wishlist) and confirm. Games will be added to your collection with a note indicating the import source.

## Technical Details

### Matching Algorithm

Games are matched using:

1. **Normalized name comparison** - Removes special characters, articles, and normalizes spacing
2. **Levenshtein distance** - Measures edit distance between strings
3. **Platform boost** - Extra confidence when platforms match

### Privacy

- **Steam imports** require a proxy to avoid CORS issues (uses Supabase Edge Functions)
- **File imports** are processed entirely in your browser
- No data is sent to external servers except for Steam API calls
- Your imported collection stays in your browser's localStorage

## Setting Up Steam API (Self-Hosted)

If you're running your own instance, you'll need to:

1. Get a Steam API key from [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
2. Deploy the Supabase Edge Function in `supabase/functions/steam/`
3. Set the `STEAM_API_KEY` secret in your Supabase project
4. Configure `VITE_SUPABASE_URL` in your environment

## CSV Format Requirements

### Generic CSV

Minimum required column: `name` (or `title`, `game`, `game_name`)

Optional columns:

- `platform` (or `system`, `console`)
- `status` (or `list`, `shelf`, `collection`)

### Status Mapping

| Input Value       | Mapped To |
| ----------------- | --------- |
| wishlist, want    | Wishlist  |
| backlog, queue    | Backlog   |
| trade, sell       | Trade     |
| owned, played, \* | Owned     |

## Troubleshooting

### Steam Import Issues

**"Profile may be private"**

- Go to [Steam Privacy Settings](https://steamcommunity.com/my/edit/settings)
- Set "Game details" to Public

**"Vanity URL not found"**

- Check your custom URL at steamcommunity.com/id/YOUR_URL
- Try using your 64-bit Steam ID instead

### No Matches Found

- Check that game names match our catalog
- Try different file exports (some services have multiple export options)
- Use Generic CSV with just game names

### Missing Games After Import

- Some games may not be in our catalog yet
- Use the "Suggest a Game" feature to add missing titles
