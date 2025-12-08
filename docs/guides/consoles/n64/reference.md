---
title: "Nintendo 64 Reference Guide"
slug: "n64-reference"
category: "console"
platform: "N64"
author: "Retro Games Hub"
date: "2025-12-08"
updated: "2025-12-08"
description: "Nintendo 64 technical reference - specifications, hardware variants, essential library, and maintenance tips."
image: "n64-reference-hero.jpg"
tags: ["reference", "retro", "Nintendo 64", "N64", "Nintendo", "specs"]
---

# Nintendo 64 Reference Guide

_Last updated: December 2025_

The Nintendo 64 was Nintendo's third home console and their first to feature 3D graphics. Released in 1996, it pioneered analog stick controls, rumble feedback, and four-player gaming out of the box.

---

## Quick Facts

| Specification    | Detail                                  |
| ---------------- | --------------------------------------- |
| **Manufacturer** | Nintendo                                |
| **Generation**   | Fifth (32/64-bit era)                   |
| **Release Date** | June 23, 1996 (JP) / Sept 29, 1996 (NA) |
| **Discontinued** | 2002 (JP) / 2002 (NA)                   |
| **Units Sold**   | 32.93 million worldwide                 |
| **Launch Price** | $199.99 USD / ¥25,000 JPY               |
| **Library Size** | 388 (NA) / 196 (JP) / 243 (PAL)         |
| **Media**        | Proprietary cartridge (4MB-64MB)        |
| **Best-Seller**  | Super Mario 64 (11.91 million)          |

---

## Technical Specifications

### CPU

| Component        | Specification                  |
| ---------------- | ------------------------------ |
| **Processor**    | NEC VR4300 (MIPS R4300i-based) |
| **Clock Speed**  | 93.75 MHz                      |
| **Architecture** | 64-bit MIPS RISC               |
| **Cache**        | 16KB instruction / 8KB data    |
| **FPU**          | Integrated, 64-bit             |

### Graphics (RCP - Reality Coprocessor)

| Component           | Specification                                |
| ------------------- | -------------------------------------------- |
| **GPU Name**        | Reality Display Processor (RDP)              |
| **Clock Speed**     | 62.5 MHz                                     |
| **Fill Rate**       | ~150,000 texture-mapped polygons/sec         |
| **Color Depth**     | 16-bit or 32-bit                             |
| **Resolution**      | 256×224 to 640×480                           |
| **Texture Mapping** | Bi-linear/tri-linear filtering               |
| **Z-Buffering**     | Hardware accelerated                         |
| **Anti-Aliasing**   | Hardware anti-aliasing (contributes to blur) |

### Signal Processor (RSP)

| Component        | Specification                         |
| ---------------- | ------------------------------------- |
| **Type**         | Reality Signal Processor              |
| **Clock Speed**  | 62.5 MHz                              |
| **Function**     | Audio, geometry, physics calculations |
| **Architecture** | MIPS-like, 8-way SIMD vector unit     |

### Memory

| Type               | Specification                |
| ------------------ | ---------------------------- |
| **System RAM**     | 4MB Rambus RDRAM (unified)   |
| **With Expansion** | 8MB (Expansion Pak required) |
| **RAM Speed**      | 500 MHz (9-bit Rambus)       |
| **Cartridge ROM**  | 4MB - 64MB per cartridge     |

### Audio

| Component           | Specification                              |
| ------------------- | ------------------------------------------ |
| **Audio Chip**      | RSP (software-processed)                   |
| **Channels**        | Up to 24 (software dependent)              |
| **Sample Rate**     | Up to 48 kHz                               |
| **Output**          | Stereo (composite A/V or S-Video)          |
| **Notable Feature** | No dedicated sound chip; CPU handles audio |

### Physical

| Dimension            | Specification     |
| -------------------- | ----------------- |
| **Size (console)**   | 260 × 190 × 73 mm |
| **Weight**           | 1.1 kg            |
| **Controller Ports** | 4 (built-in)      |
| **Power**            | 12V DC, 19W       |

### Video Output

| Output        | Quality       | Notes                              |
| ------------- | ------------- | ---------------------------------- |
| **RF**        | Poor          | Built-in modulator (JP/early NA)   |
| **Composite** | Below Average | Standard pack-in cables            |
| **S-Video**   | Good          | Best stock option (NA/JP)          |
| **RGB**       | N/A (stock)   | Requires internal mod              |
| **HDMI**      | N/A (stock)   | Requires internal mod (N64Digital) |

---

## Hardware Variants

### Console Revisions

| Revision   | Model Code | Mainboard     | Notes                                                  |
| ---------- | ---------- | ------------- | ------------------------------------------------------ |
| **Launch** | NUS-001    | NUS-CPU-01/02 | Full-size Rambus, some have poor RGB mod compatibility |
| **Rev A**  | NUS-001    | NUS-CPU-03    | Improved reliability                                   |
| **Rev B**  | NUS-001    | NUS-CPU-04    | Best for RGB/HDMI mods                                 |
| **Rev C**  | NUS-001    | NUS-CPU-05+   | Latest revision, most common                           |

### Regional Differences

| Region | Voltage        | Video Output            | Region Lock | Notes               |
| ------ | -------------- | ----------------------- | ----------- | ------------------- |
| NTSC-U | 120V, 60Hz     | Composite/S-Video       | Yes         | Standard gray color |
| NTSC-J | 100V, 60Hz     | Composite/S-Video       | Yes         | More color variants |
| PAL    | 220-240V, 50Hz | Composite/S-Video/SCART | Yes         | Slower gameplay     |

### Color Variants (Funtastic Series)

Released 1998-2000, transparent plastic shells:

| Color          | Model Code | Region | Rarity     |
| -------------- | ---------- | ------ | ---------- |
| Charcoal Gray  | NUS-001    | All    | Common     |
| Atomic Purple  | NUS-001    | NA/JP  | Common     |
| Ice Blue       | NUS-001    | NA/JP  | Moderate   |
| Jungle Green   | NUS-001    | NA     | Moderate   |
| Fire Orange    | NUS-001    | NA/JP  | Moderate   |
| Grape Purple   | NUS-001    | NA     | Scarce     |
| Watermelon Red | NUS-001    | NA     | Scarce     |
| Smoke Black    | NUS-001    | NA     | Rare       |
| Gold           | NUS-001    | NA     | Rare (TRU) |

### Special Editions

| Edition              | Region | Notes                         |
| -------------------- | ------ | ----------------------------- |
| Pikachu N64 (Blue)   | NA/JP  | Pokémon-shaped, blue & yellow |
| Pikachu N64 (Orange) | JP     | Orange variant                |
| Daiei Hawks          | JP     | Baseball team promotion       |
| Clear Blue           | JP     | Toys R Us Japan exclusive     |
| Clear Red            | JP     | Limited edition               |

---

## Controllers & Accessories

### Standard Controller (NUS-005)

| Specification      | Detail                              |
| ------------------ | ----------------------------------- |
| **Design**         | Three-prong, center grip analog     |
| **Analog Stick**   | 360° analog with octagonal gate     |
| **Buttons**        | A, B, C-buttons (4), L, R, Z, Start |
| **D-Pad**          | 8-way digital                       |
| **Expansion Port** | Memory/Rumble/Transfer Pak slot     |
| **Cable Length**   | ~6 feet (1.8m)                      |

**Common Issues:**

- Analog stick wear (grinding, looseness)
- Stick replacement options: GameCube-style, steel bowl, OEM

### Controller Pak (NUS-004)

- 256 Kbit (32KB) flash memory
- 123 pages of save data
- Required for many games (check game requirements)
- First-party has gold Nintendo logo

### Rumble Pak (NUS-013)

- Vibration feedback device
- Requires 2× AAA batteries
- Bundled with Star Fox 64
- Cannot use with Controller Pak simultaneously

### Transfer Pak (NUS-019)

- Game Boy/Game Boy Color connectivity
- Required for Pokémon Stadium (1 & 2)
- Used by: Mario Golf, Mario Tennis, Perfect Dark

### Expansion Pak (NUS-007)

- Adds 4MB RAM (total 8MB)
- Required: Majora's Mask, Donkey Kong 64, Perfect Dark (full)
- Enhanced graphics in supported titles
- Replaces Jumper Pak (must remove first)

### Third-Party Controllers

| Controller        | Notable Features                          |
| ----------------- | ----------------------------------------- |
| Hori Mini Pad     | Compact, tight analog, sought after       |
| ASCII Pad         | Japanese alternative, quality stick       |
| Brawler64         | Modern ergonomics, durable                |
| Retro-Bit Tribute | Licensed reproduction, wireless available |

---

## Library Highlights

### Essential Titles (Top 25)

| #   | Title                                | Genre            | Developer           | Year |
| --- | ------------------------------------ | ---------------- | ------------------- | ---- |
| 1   | Super Mario 64                       | Platformer       | Nintendo EAD        | 1996 |
| 2   | The Legend of Zelda: Ocarina of Time | Action-Adventure | Nintendo EAD        | 1998 |
| 3   | GoldenEye 007                        | FPS              | Rare                | 1997 |
| 4   | Super Smash Bros.                    | Fighting         | HAL Laboratory      | 1999 |
| 5   | Mario Kart 64                        | Racing           | Nintendo EAD        | 1996 |
| 6   | The Legend of Zelda: Majora's Mask   | Action-Adventure | Nintendo EAD        | 2000 |
| 7   | Paper Mario                          | RPG              | Intelligent Systems | 2000 |
| 8   | Banjo-Kazooie                        | Platformer       | Rare                | 1998 |
| 9   | Perfect Dark                         | FPS              | Rare                | 2000 |
| 10  | Star Fox 64                          | Rail Shooter     | Nintendo EAD        | 1997 |
| 11  | Diddy Kong Racing                    | Racing           | Rare                | 1997 |
| 12  | Banjo-Tooie                          | Platformer       | Rare                | 2000 |
| 13  | F-Zero X                             | Racing           | Nintendo EAD        | 1998 |
| 14  | Conker's Bad Fur Day                 | Platformer       | Rare                | 2001 |
| 15  | Pokémon Stadium 2                    | Strategy         | HAL Laboratory      | 2000 |
| 16  | Mario Party 2                        | Party            | Hudson Soft         | 1999 |
| 17  | Wave Race 64                         | Racing           | Nintendo EAD        | 1996 |
| 18  | Kirby 64: The Crystal Shards         | Platformer       | HAL Laboratory      | 2000 |
| 19  | Donkey Kong 64                       | Platformer       | Rare                | 1999 |
| 20  | 1080° Snowboarding                   | Sports           | Nintendo EAD        | 1998 |
| 21  | Ogre Battle 64                       | Strategy RPG     | Quest               | 1999 |
| 22  | Jet Force Gemini                     | Action           | Rare                | 1999 |
| 23  | Pokémon Snap                         | Rail Shooter     | HAL Laboratory      | 1999 |
| 24  | Turok 2: Seeds of Evil               | FPS              | Iguana Ent.         | 1998 |
| 25  | Pilotwings 64                        | Flight Sim       | Nintendo EAD        | 1996 |

### Games by Genre

**Platformers:**

- Super Mario 64
- Banjo-Kazooie / Banjo-Tooie
- Donkey Kong 64
- Conker's Bad Fur Day
- Kirby 64
- Rayman 2: The Great Escape

**FPS/Action:**

- GoldenEye 007
- Perfect Dark
- Turok series
- Doom 64
- Quake II

**Racing:**

- Mario Kart 64
- Diddy Kong Racing
- F-Zero X
- Wave Race 64
- 1080° Snowboarding
- Excitebike 64

**RPG:**

- Paper Mario
- Ogre Battle 64
- Quest 64
- Aidyn Chronicles
- Hybrid Heaven

**Fighting:**

- Super Smash Bros.
- Killer Instinct Gold
- Mortal Kombat Trilogy
- WWF No Mercy
- WWE WrestleMania 2000

**Multiplayer Essentials:**

- Mario Party 1/2/3
- Super Smash Bros.
- GoldenEye 007
- Mario Kart 64
- Mario Tennis
- Bomberman 64

---

## Rare & Valuable Games

### High-Value Titles

| Title                       | Loose    | CIB      | Notes                 |
| --------------------------- | -------- | -------- | --------------------- |
| Clay Fighter Sculptor's Cut | $200-350 | $500-800 | Blockbuster exclusive |
| Conker's Bad Fur Day        | $90-130  | $200-350 | Late release, mature  |
| Harvest Moon 64             | $80-120  | $250-400 | Limited print run     |
| Bomberman 64: Second Attack | $150-250 | $400-700 | Very limited release  |
| Stunt Racer 64              | $60-100  | $200-350 | Limited distribution  |
| Worms Armageddon            | $50-80   | $150-250 | Limited release       |
| Ogre Battle 64              | $70-100  | $180-280 | Atlus limited run     |
| Starcraft 64                | $60-90   | $150-250 | Niche audience        |

### Label Variants

- **Ocarina of Time**: Gold cartridge (launch), Gray cartridge (later)
- **Majora's Mask**: Gold holographic (standard), Gray (rare late run)
- **Super Mario 64**: Player's Choice (green label) less valuable
- **GoldenEye 007**: Player's Choice version common

---

## Maintenance & Repair

### Common Issues

| Issue                  | Symptom                   | Solution                             |
| ---------------------- | ------------------------- | ------------------------------------ |
| Analog stick wear      | Loose, grinding, drift    | Replace stick module                 |
| No video output        | Blank screen              | Clean cartridge slot, check AV cable |
| Game freezing          | Random crashes            | Clean cart contacts                  |
| Expansion Pak errors   | Pak not detected          | Clean contacts, reseat               |
| Controller port issues | Controller not responding | Clean port, check for bent pins      |

### Cleaning Procedures

**Cartridge Contacts:**

1. Use 90%+ isopropyl alcohol
2. Cotton swab gently on contacts
3. Let dry completely before use
4. Never use erasers (removes gold plating)

**Cartridge Slot:**

1. Use compressed air first
2. Insert cleaning cart or wrapped credit card with IPA
3. Move gently side to side
4. Let dry completely

**Console Exterior:**

- Mild soap and water on damp cloth
- Magic eraser for yellowing (careful—removes material)
- Retrobright for severe yellowing

### Analog Stick Repair

**Options:**

1. **OEM replacement** - Authentic feel, will wear again
2. **GameCube-style** - Different feel, more durable
3. **Steel bowl mod** - Reduces wear on OEM stick
4. **Hori Mini Pad** - Best stick, buy whole controller

---

## Video Output Guide

### Stock Options

| Output    | Cable            | Quality   | Availability           |
| --------- | ---------------- | --------- | ---------------------- |
| RF        | RF switch        | Poor      | Pack-in (some regions) |
| Composite | Yellow/Red/White | Below Avg | Most common            |
| S-Video   | S-Video cable    | Good      | Best stock option      |

### Mod Options

**RGB Mod:**

- Tim Worthington's N64RGB
- VoultatrEE's N64RGB
- Outputs to SCART → OSSC/RetroTINK

**HDMI Mods:**

- N64Digital (Pixel FX)
- UltraHDMI (discontinued)
- PixelHD
- Internally installed, zero lag

### Upscalers

| Device       | Input       | Quality   | Price |
| ------------ | ----------- | --------- | ----- |
| RetroTINK 5X | S-Video/RGB | Excellent | $300  |
| RetroTINK 2X | S-Video     | Good      | $130  |
| OSSC         | RGB         | Excellent | $200  |
| RAD2X        | S-Video     | Good      | $80   |

---

## Emulation Options

### Official

- **Nintendo Switch Online** - N64 library with online multiplayer
- **Wii Virtual Console** - Classic lineup
- **Wii U Virtual Console** - Expanded library

### Hardware Clones

| Device         | Compatibility | Features             |
| -------------- | ------------- | -------------------- |
| Analogue 3D    | Excellent     | FPGA, native HDMI    |
| None currently | -             | Limited clone market |

### Flash Carts

| Cart            | Price    | Features                      |
| --------------- | -------- | ----------------------------- |
| EverDrive 64 X7 | $170-220 | SD card, save states, cheats  |
| EverDrive 64 X5 | $100-130 | Budget option, fewer features |
| 64drive         | $250+    | Premium, fastest loading      |

---

## History & Legacy

### Development Timeline

| Year | Event                                                    |
| ---- | -------------------------------------------------------- |
| 1993 | Project Reality announced (Silicon Graphics partnership) |
| 1994 | Renamed Ultra 64                                         |
| 1995 | Final name: Nintendo 64                                  |
| 1996 | Launch in Japan (June) and NA (September)                |
| 1997 | GoldenEye 007 becomes system-seller                      |
| 1998 | Ocarina of Time wins universal acclaim                   |
| 2000 | Majora's Mask, last major first-party game               |
| 2001 | GameCube launches, N64 support winds down                |
| 2002 | Production ends                                          |

### Design Philosophy

Nintendo chose cartridges over CDs for several reasons:

- Faster load times
- Harder to pirate
- More durable
- Higher manufacturing cost (limited third-party support)

The decision cost Nintendo significant third-party support, with Square and Enix notably moving to PlayStation. However, it resulted in a focused library of higher-quality titles.

### Cultural Impact

- Pioneered analog stick as standard input
- Established 3D platforming conventions (Super Mario 64)
- Defined console FPS gaming (GoldenEye)
- Popularized rumble feedback
- Created lasting four-player multiplayer culture

---

## Resources

### Official Documentation

- Nintendo 64 Programming Manual (leaked/archived)
- N64 Development Wiki

### Community

- r/n64 - Reddit community
- N64Forever - Dedicated forums
- N64 Squid - News and features
- Assembly-Games - Archival community

### Technical Reference

- Nintendo 64 Homebrew Wiki
- N64 Compatibility Lists
- Ultra64.ca - Technical documentation

### Price Tracking

- PriceCharting.com
- GameValueNow
- Video Game Price Charts

---

_Use our [collection tracker](/app) to manage your N64 library._

_See also: [N64 Collecting Guide](./collecting-guide.md) for market analysis and collecting strategies._
