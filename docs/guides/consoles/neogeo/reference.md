---
title: "Neo Geo - Complete Reference Guide"
description: "Comprehensive technical reference for the SNK Neo Geo AES and MVS systems, covering hardware specifications, variants, and library highlights"
console: Neo Geo
type: reference
difficulty: Expert
layout: guide
last_updated: 2025-01-01
---

# Neo Geo Reference Guide

## Quick Facts

| Attribute           | Neo Geo AES (Home)          | Neo Geo MVS (Arcade)        |
| ------------------- | --------------------------- | --------------------------- |
| **Manufacturer**    | SNK Corporation             | SNK Corporation             |
| **Release (JP)**    | April 26, 1990              | 1990                        |
| **Release (NA)**    | August 22, 1990             | 1990                        |
| **Discontinuation** | 1997 (AES) / 2004 (MVS)     | 2004                        |
| **MSRP (Launch)**   | $649.99 (USA)               | Varies (arcade only)        |
| **CPU**             | Motorola 68000 @ 12 MHz     | Motorola 68000 @ 12 MHz     |
| **Co-processor**    | Zilog Z80 @ 4 MHz           | Zilog Z80 @ 4 MHz           |
| **RAM**             | 64 KB main + 64 KB video    | 64 KB main + 64 KB video    |
| **VRAM**            | 68 KB                       | 68 KB                       |
| **Sound RAM**       | 2 KB                        | 2 KB                        |
| **Max Sprites**     | 380 on-screen (96 per line) | 380 on-screen (96 per line) |
| **Colors**          | 4,096 on-screen from 65,536 | 4,096 on-screen from 65,536 |
| **Resolution**      | 320×224 pixels              | 320×224 pixels              |
| **Library Size**    | 157 official games          | 157+ games                  |

---

## Console Overview

### Introduction

The Neo Geo is the most legendary arcade/home system ever created. SNK's revolutionary concept delivered arcade-perfect gaming at home by using identical hardware and software across both the arcade (MVS - Multi Video System) and home (AES - Advanced Entertainment System) platforms. This "arcade at home" philosophy came at a premium price that created both its mystique and its devoted collector following.

### Historical Significance

**Industry Impact:**

- First true arcade-quality home console
- Pioneered the "same hardware" arcade/home concept
- Established SNK's fighting game dominance
- Created the template for premium gaming hardware
- Longest-supported arcade platform in history (1990-2004)
- Most expensive gaming collectibles market

**Gaming Legacy:**

- Fighting game genre definition (Fatal Fury, Art of Fighting, KOF, Samurai Shodown)
- Run-and-gun excellence (Metal Slug series)
- 2D graphics pinnacle achievement
- Competitive gaming culture foundation

---

## Hardware Platforms

### Neo Geo AES (Home Console)

| Attribute          | Specification                        |
| ------------------ | ------------------------------------ |
| **Release**        | April 26, 1990                       |
| **Launch Price**   | $649.99 (USA) / ¥58,000 (Japan)      |
| **Form Factor**    | Large console with slot-loading      |
| **Controllers**    | 2 ports, distinctive joystick design |
| **AV Output**      | Composite, S-Video, RGB              |
| **Power**          | External power supply                |
| **Collectibility** | ★★★★★ Premium collector platform     |

**Notable Characteristics:**

- Identical games to arcade MVS
- Memory card support for saving
- Massive cartridge size (up to 716 Mbit)
- Premium build quality
- Two large arcade-style controllers included

### Neo Geo MVS (Arcade)

| Attribute          | Specification                           |
| ------------------ | --------------------------------------- |
| **Type**           | Arcade system board                     |
| **Configuration**  | 1-slot, 2-slot, 4-slot, 6-slot cabinets |
| **Purpose**        | Commercial arcade operation             |
| **Cartridge**      | MVS format (larger, different pinout)   |
| **Advantages**     | Lower game cost, interchangeable slots  |
| **Collectibility** | ★★★★★ Affordable alternative            |

**MVS Cabinet Types:**

- **1-slot**: Single game, compact
- **2-slot**: Two games, most common
- **4-slot**: Four games, popular in arcades
- **6-slot**: Six games, large candy cabinet

### Neo Geo CD

| Attribute          | Specification             |
| ------------------ | ------------------------- |
| **Release**        | September 9, 1994 (Japan) |
| **Price**          | $399 / ¥49,800            |
| **Media**          | CD-ROM                    |
| **RAM**            | 56 Mbit (7 MB)            |
| **Loading**        | Notorious long load times |
| **Collectibility** | ★★★☆☆ Budget alternative  |

**Neo Geo CD Variants:**

| Model        | Release | Drive Type | Load Speed | Notes            |
| ------------ | ------- | ---------- | ---------- | ---------------- |
| Front-loader | 1994    | 1x         | Slowest    | Original design  |
| Top-loader   | 1995    | 1x         | Slow       | Improved design  |
| CDZ          | 1996    | 2x         | Faster     | Japan-only, best |

**CD Limitations:**

- Loading times 30 seconds to 2+ minutes
- Some games heavily cut due to RAM limits
- CDZ addresses speed but still slow by modern standards
- CD games much cheaper than cartridge versions

### Neo Geo Pocket / Color

| Attribute          | Neo Geo Pocket (1998) | Neo Geo Pocket Color (1999) |
| ------------------ | --------------------- | --------------------------- |
| **Display**        | 2.7" B&W LCD          | 2.7" Color TFT LCD          |
| **Resolution**     | 160×152 pixels        | 160×152 pixels              |
| **CPU**            | Toshiba TLCS-900H     | Toshiba TLCS-900H           |
| **Games**          | 10 games              | 82 games                    |
| **Battery**        | 40 hours (1 AA)       | 40 hours (2 AAA)            |
| **Collectibility** | ★★★★☆ Rare original   | ★★★★★ Premium handheld      |

---

## Technical Specifications

### Processor Details

**Main CPU: Motorola 68000**

- Clock speed: 12 MHz
- 32-bit internal architecture
- 16-bit external data bus
- 24-bit address bus (16 MB addressable)

**Sound CPU: Zilog Z80**

- Clock speed: 4 MHz
- Dedicated to audio processing
- Controls Yamaha YM2610 sound chip

### Graphics Architecture

**Custom Graphics Processor:**

| Capability        | Specification                  |
| ----------------- | ------------------------------ |
| Resolution        | 320×224 pixels                 |
| Tile Layers       | 1 background layer (scrolling) |
| Sprite Layers     | 380 sprites simultaneously     |
| Sprites per Line  | 96 maximum                     |
| Sprite Size       | 16×16 to 16×512 pixels         |
| Colors per Sprite | 16 from 256 palette entries    |
| Total Palette     | 65,536 colors (16-bit RGB)     |
| On-screen Colors  | 4,096 simultaneous             |

**2D Powerhouse:**

- Massive sprite counts enabled fighting game animations
- Line-scrolling effects (parallax, scaling simulation)
- Designed specifically for 2D gaming excellence

### Sound System

**Yamaha YM2610 Sound Chip:**

| Component      | Capability                       |
| -------------- | -------------------------------- |
| FM Synthesis   | 4 channels                       |
| SSG (PSG)      | 3 channels                       |
| ADPCM-A        | 6 channels (sample playback)     |
| ADPCM-B        | 1 channel (high-quality samples) |
| Total Channels | 14 simultaneous                  |

**Audio Quality:**

- CD-quality sound possible via ADPCM
- Distinctive SNK sound signature
- Large sample ROM space in cartridges

---

## Media Formats

### AES Cartridges

| Attribute     | Specification                 |
| ------------- | ----------------------------- |
| **Type**      | Large ROM cartridge           |
| **Size**      | 2 Mbit to 716 Mbit            |
| **Physical**  | ~6" × 4" × 1" (massive)       |
| **Connector** | Unique AES pinout             |
| **Case**      | Plastic shockbox with artwork |
| **Inserts**   | Manual, promotional materials |

**Notable Cartridge Sizes:**

| Game                 | Size (Mbit) | Notes                 |
| -------------------- | ----------- | --------------------- |
| NAM-1975             | 46          | Launch title          |
| Fatal Fury 2         | 106         | Mid-generation        |
| King of Fighters '94 | 196         | KOF series begins     |
| The Last Blade 2     | 554         | Late-era excellence   |
| Kizuna Encounter     | 716         | Largest AES cartridge |

### MVS Cartridges

| Attribute     | Specification                      |
| ------------- | ---------------------------------- |
| **Type**      | Arcade board cartridge             |
| **Size**      | Same as AES internally             |
| **Physical**  | Larger board form factor           |
| **Connector** | Different pinout from AES          |
| **Case**      | Cardboard shockbox (often)         |
| **Inserts**   | Artwork, marquee, instruction card |

**MVS Advantages:**

- Much lower cost than AES
- Identical gameplay
- Can be converted to play on AES

### CD-ROM

| Attribute    | Specification                 |
| ------------ | ----------------------------- |
| **Type**     | Standard CD-ROM               |
| **Capacity** | Up to 640 MB                  |
| **Loading**  | Required between areas/rounds |
| **Cases**    | Standard jewel case           |
| **Cost**     | Fraction of cartridge price   |

---

## Library Overview

### Game Statistics

| Format         | Official Games | Region Notes                  |
| -------------- | -------------- | ----------------------------- |
| AES/MVS        | 157            | Same games, different formats |
| Neo Geo CD     | ~100           | Subset of cartridge library   |
| Neo Geo Pocket | 10             | Monochrome only               |
| NGPC           | 82             | Full color                    |

### Essential Titles by Genre

#### Fighting Games (The Crown Jewels)

| Title                     | Year | Rarity | Note                      |
| ------------------------- | ---- | ------ | ------------------------- |
| Fatal Fury Special        | 1993 | Common | Refined Fatal Fury        |
| Samurai Shodown II        | 1994 | Scarce | Weapon-based perfection   |
| The King of Fighters '98  | 1998 | Common | "Dream Match" perfection  |
| The King of Fighters 2002 | 2002 | Scarce | Another Dream Match       |
| Garou: Mark of the Wolves | 1999 | Rare   | Fatal Fury finale         |
| The Last Blade 2          | 1998 | Rare   | Beautiful weapons fighter |
| Real Bout Fatal Fury 2    | 1998 | Scarce | Technical fighting        |
| Matrimelee                | 2003 | Rare   | Late-era gem              |
| Art of Fighting 3         | 1996 | Scarce | Graphical showcase        |

#### Run-and-Gun / Action

| Title                     | Year | Rarity | Note                  |
| ------------------------- | ---- | ------ | --------------------- |
| Metal Slug                | 1996 | Scarce | Legendary run-and-gun |
| Metal Slug 2              | 1998 | Scarce | Bigger and better     |
| Metal Slug X              | 1999 | Scarce | Refined Metal Slug 2  |
| Metal Slug 3              | 2000 | Rare   | Massive, diverse      |
| Metal Slug 4              | 2002 | Scarce | Different developer   |
| Metal Slug 5              | 2003 | Rare   | Final MVS entry       |
| Shock Troopers            | 1997 | Rare   | Excellent alternative |
| Shock Troopers: 2nd Squad | 1998 | Rare   | Sequel                |

#### Sports

| Title             | Year | Rarity | Note                 |
| ----------------- | ---- | ------ | -------------------- |
| Neo Turf Masters  | 1996 | Rare   | Excellent golf game  |
| Super Sidekicks 3 | 1995 | Scarce | Soccer/football      |
| Baseball Stars 2  | 1992 | Scarce | Deep baseball sim    |
| Windjammers       | 1994 | Scarce | Cult classic frisbee |

#### Shooters

| Title        | Year | Rarity | Note                       |
| ------------ | ---- | ------ | -------------------------- |
| Blazing Star | 1998 | Rare   | Excellent horizontal shmup |
| Pulstar      | 1995 | Rare   | R-Type spiritual successor |
| Last Resort  | 1992 | Scarce | Early quality shooter      |
| Viewpoint    | 1992 | Scarce | Isometric shooter          |

#### Puzzle

| Title                  | Year | Rarity | Note               |
| ---------------------- | ---- | ------ | ------------------ |
| Puzzle Bobble          | 1994 | Common | Taito classic port |
| Magical Drop III       | 1997 | Scarce | Fast puzzle action |
| Money Puzzle Exchanger | 1997 | Rare   | Unique gem         |

---

## Rare & Valuable Games

### AES Holy Grails

| Title                     | Loose   | CIB      | Notes                    |
| ------------------------- | ------- | -------- | ------------------------ |
| Kizuna Encounter          | $8,000+ | $15,000+ | Rarest official AES      |
| Matrimelee                | $3,000+ | $6,000+  | Limited production       |
| The Last Blade 2          | $2,500+ | $5,000+  | Late-era masterpiece     |
| Blazing Star              | $2,000+ | $4,000+  | Excellent shooter        |
| Garou: Mark of the Wolves | $1,500+ | $3,000+  | Fighting game perfection |
| Metal Slug (all entries)  | $800+   | $2,000+  | Iconic series            |
| Shock Troopers            | $1,500+ | $3,500+  | Run-and-gun excellence   |
| Neo Turf Masters          | $1,000+ | $2,500+  | Sports rarity            |

### AES Value Tiers

| Tier       | Price Range   | Example Titles                           |
| ---------- | ------------- | ---------------------------------------- |
| Common     | $100-300      | NAM-1975, Baseball Stars, early fighters |
| Uncommon   | $300-700      | Fatal Fury Special, early KOF entries    |
| Scarce     | $700-1,500    | Samurai Shodown II, KOF '98              |
| Rare       | $1,500-3,000  | Garou, Last Blade 2, Metal Slug entries  |
| Ultra-Rare | $3,000-8,000+ | Kizuna, Matrimelee, Blazing Star         |

### MVS Value Comparison

MVS cartridges typically cost 10-20% of AES equivalents:

| AES Title             | AES Price | MVS Price | Savings |
| --------------------- | --------- | --------- | ------- |
| Metal Slug 3          | $3,000+   | $300-500  | 85-90%  |
| Garou: Mark of Wolves | $2,500+   | $250-400  | 85-90%  |
| Blazing Star          | $3,500+   | $300-500  | 85-90%  |
| KOF '98               | $800+     | $50-100   | 90%+    |

### Neo Geo CD Values

CD games are dramatically cheaper:

| Title        | CD Price | AES Price | Notes              |
| ------------ | -------- | --------- | ------------------ |
| Metal Slug   | $100-150 | $1,500+   | Same game, loading |
| Garou: MOTW  | $80-120  | $2,500+   | Affordable option  |
| Last Blade 2 | $60-100  | $4,000+   | Best budget option |
| KOF '98      | $30-50   | $800+     | Great value        |

---

## Hardware Accessories

### Controllers

| Controller              | Type               | Est. Value | Notes                 |
| ----------------------- | ------------------ | ---------- | --------------------- |
| AES Joystick (original) | Arcade-style stick | $100-200   | Included with console |
| Pro Controller          | Fighting stick     | $150-300   | Improved design       |
| CD Controller           | Compact gamepad    | $50-100    | Standard for CD       |
| Neo Geo Stick 2         | Arcade stick       | $150-250   | Later improvement     |
| SuperGun compatible     | Various            | $50-200    | For MVS boards        |

### Memory Cards

| Card                 | Capacity         | Est. Value | Notes                |
| -------------------- | ---------------- | ---------- | -------------------- |
| Official Memory Card | 2 KB (19 blocks) | $40-80     | Standard saves       |
| Third-party Cards    | Varies           | $20-50     | Compatibility varies |

### AV Accessories

| Accessory            | Purpose            | Est. Value | Notes             |
| -------------------- | ------------------ | ---------- | ----------------- |
| RGB SCART Cable      | Best video quality | $30-60     | Essential for AES |
| S-Video Cable        | Good video quality | $20-40     | Available option  |
| AV Cable (Composite) | Basic video        | $15-30     | Pack-in quality   |
| CDZ Adapter          | Region play        | $30-60     | For import CDZ    |

---

## MVS Playing Options

### Consolized MVS

Converting MVS hardware for home use:

**Options:**

1. **MVS Consolizer Kit**: $100-200, adds controller ports and AV out
2. **Pre-built Consolized**: $200-400, ready to use
3. **CMVS (Custom MVS)**: $300-600, premium builds
4. **Omega MVS**: Commercial consolized product

**Advantages:**

- Play MVS carts at home
- 90% cost savings on games
- Same hardware as arcade
- UniBIOS for region/features

### SuperGun Setup

Using arcade boards with TV:

**Components Needed:**

1. SuperGun device ($100-300)
2. MVS board (1-slot: $50-100)
3. Power supply
4. Controller adapters

**Advantages:**

- Plays any JAMMA arcade board
- Most affordable entry
- Authentic arcade experience

### UniBIOS

Custom BIOS with enhanced features:

**Features:**

- Region switching (JP/US/EU)
- AES/MVS mode switching
- Cheats and diagnostics
- Memory card management
- Essential for collectors

---

## Common Issues & Repairs

### AES Console Issues

**Cartridge Slot Problems:**

- Symptoms: Games not reading, corrupted graphics
- Cause: Dirty or worn contacts
- Solution: Clean with isopropyl alcohol, inspect for damage
- Prevention: Clean cartridge contacts before insertion

**Controller Port Failure:**

- Symptoms: Inputs not registering
- Cause: Connector wear, broken solder joints
- Solution: Reflow solder, replace connector
- Difficulty: Moderate

**Power Issues:**

- Symptoms: No power, intermittent startup
- Cause: Power supply failure, capacitors
- Solution: Replace PSU or recap
- Prevention: Use quality power supply

### MVS Board Issues

**Battery Backup:**

- All MVS boards have backup battery
- Dead battery = lost settings/saves
- Solution: Replace battery (easy)
- Prevention: Replace proactively every 5-10 years

**Jailbar Pattern:**

- Symptoms: Vertical lines in graphics
- Cause: RAM or graphics chip issues
- Solution: Replace affected chips
- Difficulty: Advanced

### Neo Geo CD Issues

**Laser Failure:**

- Most common issue (25+ years old)
- Symptoms: Won't read discs
- Solution: Laser adjustment or replacement
- Parts becoming scarce

**Motor Problems:**

- Symptoms: Disc not spinning
- Cause: Motor failure, belt issues
- Solution: Motor replacement

---

## Region & Compatibility

### AES Region Information

**Region Versions:**

| Region | Label Language | Price (Original) |
| ------ | -------------- | ---------------- |
| Japan  | Japanese       | ¥28,000-48,000   |
| USA    | English        | $200-650         |
| Europe | English        | £399-500         |

**Important:** AES games are region-locked. Japanese AES plays Japanese games only without modification.

### Region Modification

**Options:**

1. **UniBIOS**: Allows region switching without hardware mod
2. **Region Mod**: Physical modification to console
3. **Import Console**: Buy console matching game region

### MVS Region

MVS boards are typically region-free with UniBIOS installed. Original MVS games often have all regions on board.

---

## Modern Playing Options

### Original Hardware

**Best AES Setup:**

1. AES console (any region)
2. UniBIOS installation
3. RGB SCART cable
4. Quality upscaler (RetroTINK, OSSC)
5. Arcade stick controller

**Best MVS Setup:**

1. Consolized MVS or SuperGun
2. UniBIOS installed
3. MVS cartridge collection
4. Arcade stick

### Flash Carts & ODEs

| Product          | Platform | Price | Notes                   |
| ---------------- | -------- | ----- | ----------------------- |
| NeoSD            | AES/MVS  | $450+ | Full library on SD card |
| NeoSD Pro        | AES/MVS  | $500+ | Enhanced version        |
| Darksoft Multi   | MVS      | $300+ | MVS multi-game solution |
| Terraonion NeoSD | AES/MVS  | $500+ | Premium option          |

### Emulation

**Emulator Options:**

- **MAME**: Most accurate, arcade focus
- **FinalBurn Neo**: Excellent compatibility
- **RetroArch (FB cores)**: Cross-platform

**FPGA Options:**

- **MiSTer**: Accurate Neo Geo core
- **Analogue Pocket**: With adapter (when available)

---

## Collecting Tips

### Entry Points by Budget

**Budget Start ($300-500):**

- Neo Geo CD top-loader
- 5-10 CD games
- Sample the library affordably

**MVS Route ($500-1,000):**

- Consolized MVS or SuperGun
- 10-20 MVS carts
- Same games as AES at fraction of cost

**AES Starter ($2,000-3,000):**

- AES console
- 5-10 common AES games
- Begin the premium journey

**Serious Collector ($10,000+):**

- Complete AES console setup
- Key library titles
- Expanding toward completion

### What to Look For

**AES Purchases:**

1. Test cartridge reading
2. Check controller ports
3. Verify video output quality
4. Inspect cartridge slot wear
5. Test memory card slot

**MVS Purchases:**

1. Verify board boots
2. Check all slots (multi-slot)
3. Test with known-good game
4. Inspect for battery corrosion
5. Check JAMMA connector

**Game Purchases:**

1. Verify label authenticity
2. Check PCB for damage/repairs
3. Test gameplay
4. Inspect shockbox condition
5. Verify manual and inserts

### Authentication

**Counterfeit Warning Signs:**

- Wrong label material or printing
- Incorrect board revisions
- Missing SNK security chip
- Wrong PCB color or design
- Spelling errors on labels

**High-Risk Titles (Verify Carefully):**

- All late-era AES games
- Metal Slug series
- Garou: Mark of the Wolves
- Matrimelee
- Any sealed "rare" AES

---

## Quick Reference

### Platform Comparison

| Aspect        | AES           | MVS        | CD            |
| ------------- | ------------- | ---------- | ------------- |
| Game Cost     | Expensive     | Affordable | Cheapest      |
| Hardware Cost | Expensive     | Moderate   | Affordable    |
| Convenience   | High          | Moderate   | High          |
| Loading       | Instant       | Instant    | Very slow     |
| Authenticity  | Home original | Arcade     | Budget option |
| Best For      | Collectors    | Players    | Budget gamers |

### Top 10 Must-Play

1. King of Fighters '98
2. Garou: Mark of the Wolves
3. Metal Slug 3
4. Samurai Shodown II
5. The Last Blade 2
6. Blazing Star
7. Windjammers
8. Metal Slug X
9. Neo Turf Masters
10. King of Fighters 2002

### Value Quick Reference

| If Looking For...  | Buy This Format      |
| ------------------ | -------------------- |
| Affordable gaming  | MVS + consolizer     |
| Cheapest games     | Neo Geo CD           |
| Collector prestige | AES cartridges       |
| Portable           | Neo Geo Pocket Color |
| Modern convenience | NeoSD flash cart     |

---

## See Also

- [Neo Geo Collecting Guide](./collecting-guide.md) - Complete collecting strategy
- [Console Library Index](../README.md) - All console guides

---

_Last updated: January 2025_
