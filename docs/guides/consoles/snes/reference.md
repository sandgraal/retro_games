---
title: "Super Nintendo Reference Guide"
slug: "snes-reference"
category: "console"
platform: "SNES"
author: "Retro Games Hub"
date: "2025-12-08"
updated: "2025-12-08"
description: "Super Nintendo technical reference - specifications, hardware variants, essential library, and maintenance tips."
image: "snes-reference-hero.jpg"
tags:
  ["reference", "retro", "Super Nintendo", "SNES", "Super Famicom", "Nintendo", "specs"]
---

# Super Nintendo Reference Guide

_Last updated: December 2025_

The Super Nintendo Entertainment System (SNES) represents Nintendo's 16-bit golden age. Released in 1990 in Japan and 1991 in North America, it delivered stunning graphics, memorable soundtracks, and some of the greatest games ever made.

---

## Quick Facts

| Specification    | Detail                                |
| ---------------- | ------------------------------------- |
| **Manufacturer** | Nintendo                              |
| **Generation**   | Fourth (16-bit era)                   |
| **Release Date** | Nov 21, 1990 (JP) / Aug 23, 1991 (NA) |
| **Discontinued** | 2003 (JP)                             |
| **Units Sold**   | 49.1 million worldwide                |
| **Launch Price** | $199.99 USD / ¥25,000 JPY             |
| **Library Size** | 721 (NA) / 1,447 (JP) / 521 (PAL)     |
| **Media**        | Proprietary cartridge (256KB-6MB)     |
| **Best-Seller**  | Super Mario World (20.6 million)      |

---

## Technical Specifications

### CPU

| Component         | Specification                          |
| ----------------- | -------------------------------------- |
| **Processor**     | Ricoh 5A22 (65816-based)               |
| **Clock Speed**   | 3.58 MHz (max), often 2.68 or 1.79 MHz |
| **Architecture**  | 16-bit (8-bit bus width)               |
| **Address Space** | 24-bit (16MB addressable)              |

### Graphics (PPU)

| Component           | Specification                   |
| ------------------- | ------------------------------- |
| **PPU Type**        | S-PPU1 + S-PPU2 (dual chip)     |
| **Resolution**      | 256×224 to 512×448 (interlaced) |
| **Colors**          | 32,768 palette, 256 on-screen   |
| **Sprites**         | 128 sprites, 32 per scanline    |
| **Sprite Size**     | 8×8 to 64×64 pixels             |
| **Backgrounds**     | 4 layers, various modes         |
| **Special Effects** | Mode 7, transparency, mosaic    |

### Video Modes

| Mode   | BG Layers | Colors/Tile | Notes                           |
| ------ | --------- | ----------- | ------------------------------- |
| Mode 0 | 4         | 4           | Fast action games               |
| Mode 1 | 3         | 16/16/4     | Most common mode                |
| Mode 2 | 2         | 16          | Line scrolling                  |
| Mode 3 | 2         | 256/16      | Direct color                    |
| Mode 4 | 2         | 256/4       | Direct color variant            |
| Mode 5 | 2         | 16/4        | Hi-res 512 pixels               |
| Mode 6 | 1         | 16          | Hi-res with offset              |
| Mode 7 | 1         | 256         | Rotation/scaling (F-Zero, etc.) |

### Memory

| Type               | Specification          |
| ------------------ | ---------------------- |
| **System RAM**     | 128KB (1 Mbit)         |
| **Video RAM**      | 64KB                   |
| **Audio RAM**      | 64KB                   |
| **Cartridge ROM**  | 256KB to 6MB (48 Mbit) |
| **Cartridge SRAM** | 0-256KB (save games)   |

### Audio (S-SMP / S-DSP)

| Component       | Specification                         |
| --------------- | ------------------------------------- |
| **Sound CPU**   | Sony SPC700 @ 2.048 MHz               |
| **Sound DSP**   | S-DSP (8-channel)                     |
| **Channels**    | 8 stereo                              |
| **Sample Rate** | 32 kHz                                |
| **Format**      | 4-bit ADPCM compressed samples        |
| **Effects**     | Echo, reverb, noise, pitch modulation |
| **Output**      | Stereo, via Multi-Out                 |

### Physical

| Dimension            | Specification      |
| -------------------- | ------------------ |
| **Size (NA)**        | 200 × 242 × 72 mm  |
| **Size (JP/PAL)**    | 200 × 242 × 66 mm  |
| **Weight**           | ~0.9 kg            |
| **Controller Ports** | 2                  |
| **Power**            | AC adapter, 10V DC |

### Video Output

| Output        | Quality     | Notes                          |
| ------------- | ----------- | ------------------------------ |
| **RF**        | Poor        | Not recommended                |
| **Composite** | Average     | Standard pack-in               |
| **S-Video**   | Good        | NA consoles, Multi-Out         |
| **RGB**       | Excellent   | Multi-Out, native support      |
| **Component** | N/A (stock) | Requires HD Retrovision cables |

---

## Hardware Variants

### Console Models

| Model          | Region | Code     | Notes                           |
| -------------- | ------ | -------- | ------------------------------- |
| Super Famicom  | Japan  | SHVC-001 | Rounded design, JP carts only   |
| SNES           | NA     | SNS-001  | Boxy purple/gray, NA carts only |
| Super Nintendo | PAL    | SNSP-001 | Same as SFC shape, PAL timing   |
| SNES Jr        | NA     | SNS-101  | Compact redesign (1997)         |
| SFC Jr         | Japan  | SHVC-101 | Compact (1998)                  |

### Regional Differences

| Region | Voltage    | Video       | Cart Shape  | Speed             |
| ------ | ---------- | ----------- | ----------- | ----------------- |
| NTSC-U | 120V, 60Hz | S-Video/RGB | Rectangular | 60Hz              |
| NTSC-J | 100V, 60Hz | RGB         | Rounded     | 60Hz              |
| PAL    | 220V, 50Hz | RGB/SCART   | Rounded     | 50Hz (17% slower) |

### Motherboard Revisions

| Revision      | Chips | Video Quality | Notes               |
| ------------- | ----- | ------------- | ------------------- |
| SHVC (1-chip) | 2     | Excellent     | Best output quality |
| SNS-CPU-1CHIP | 1     | Very Good     | Good for RGB        |
| SNS-CPU-GPM   | 2     | Good          | Common revision     |
| SNS-CPU-APU   | 2     | Average       | Earlier revision    |

### Special Editions

| Edition                 | Region | Notes                               |
| ----------------------- | ------ | ----------------------------------- |
| Super Famicom Box       | JP     | Hotel/demo unit with built-in games |
| SF Memory (Satellaview) | JP     | Satellite add-on for downloads      |
| SNES Classic Mini       | All    | 2017 micro console, 21 games        |

---

## Enhancement Chips

The SNES supported cartridge-based enhancement chips for advanced capabilities:

### Graphics Enhancement

| Chip           | Function                    | Notable Games                      |
| -------------- | --------------------------- | ---------------------------------- |
| **Super FX**   | 3D polygon rendering        | Star Fox, Doom, Yoshi's Island     |
| **Super FX 2** | Enhanced Super FX           | Yoshi's Island, Winter Gold        |
| **Cx4**        | Wireframe graphics          | Mega Man X2, X3                    |
| **SA-1**       | Speed increase, compression | Super Mario RPG, Kirby Super Star  |
| **S-DD1**      | Decompression               | Star Ocean, Street Fighter Alpha 2 |

### Sound Enhancement

| Chip          | Function              | Notable Games                 |
| ------------- | --------------------- | ----------------------------- |
| **DSP-1**     | Math coprocessor      | Super Mario Kart, Pilotwings  |
| **DSP-2/3/4** | Advanced DSP variants | Dungeon Master, Top Gear 3000 |

### Other

| Chip        | Function              | Notable Games             |
| ----------- | --------------------- | ------------------------- |
| **OBC1**    | RAM expansion         | Metal Combat              |
| **SPC7110** | Data compression      | Far East of Eden Zero     |
| **ST0XX**   | Various special chips | Various Japan-only titles |

---

## Controllers & Accessories

### Standard Controller (SHVC-005)

| Specification        | Detail                      |
| -------------------- | --------------------------- |
| **Design**           | Rounded, shoulder buttons   |
| **D-Pad**            | Cross-shaped, 8-way         |
| **Face Buttons**     | A, B, X, Y (diamond layout) |
| **Shoulder Buttons** | L, R                        |
| **Other**            | Start, Select               |
| **Cable Length**     | ~6 feet (1.8m)              |

### Accessories

| Accessory        | Code     | Purpose                   |
| ---------------- | -------- | ------------------------- |
| Super Multitap   | SHVC-009 | 4-player adapter          |
| Super Scope      | SHVC-013 | Light gun (6 games)       |
| SNES Mouse       | SNS-016  | Point-and-click games     |
| Super Game Boy   | SNS-027  | Game Boy adapter          |
| Super Game Boy 2 | SHVC-042 | Improved GB adapter (JP)  |
| Satellaview      | SHVC-029 | Satellite modem (JP only) |

### Third-Party Controllers

| Controller              | Notable Features             |
| ----------------------- | ---------------------------- |
| ASCII Pad               | Quality alternative          |
| Hori Fighting Commander | 6-button layout              |
| 8BitDo SN30 Pro         | Modern wireless reproduction |
| Retro-Bit Tribute       | Licensed reproduction        |

---

## Library Highlights

### Essential Titles (Top 25)

| #   | Title                           | Genre        | Developer         | Year |
| --- | ------------------------------- | ------------ | ----------------- | ---- |
| 1   | The Legend of Zelda: ALttP      | Action RPG   | Nintendo          | 1991 |
| 2   | Super Mario World               | Platformer   | Nintendo          | 1990 |
| 3   | Chrono Trigger                  | RPG          | Square            | 1995 |
| 4   | Super Metroid                   | Action       | Nintendo          | 1994 |
| 5   | Final Fantasy VI (III)          | RPG          | Square            | 1994 |
| 6   | Super Mario RPG                 | RPG          | Square            | 1996 |
| 7   | EarthBound                      | RPG          | Ape/HAL           | 1995 |
| 8   | Donkey Kong Country 2           | Platformer   | Rare              | 1995 |
| 9   | Super Mario Kart                | Racing       | Nintendo          | 1992 |
| 10  | Mega Man X                      | Action       | Capcom            | 1993 |
| 11  | Yoshi's Island                  | Platformer   | Nintendo          | 1995 |
| 12  | Secret of Mana                  | Action RPG   | Square            | 1993 |
| 13  | Street Fighter II Turbo         | Fighting     | Capcom            | 1993 |
| 14  | Contra III: The Alien Wars      | Action       | Konami            | 1992 |
| 15  | Castlevania IV                  | Action       | Konami            | 1991 |
| 16  | F-Zero                          | Racing       | Nintendo          | 1990 |
| 17  | Star Fox                        | Rail Shooter | Nintendo/Argonaut | 1993 |
| 18  | Donkey Kong Country             | Platformer   | Rare              | 1994 |
| 19  | Kirby Super Star                | Platformer   | HAL               | 1996 |
| 20  | Final Fantasy IV (II)           | RPG          | Square            | 1991 |
| 21  | Teenage Mutant Ninja Turtles IV | Beat 'em Up  | Konami            | 1992 |
| 22  | ActRaiser                       | Action/Sim   | Enix              | 1990 |
| 23  | Terranigma                      | Action RPG   | Enix              | 1995 |
| 24  | Breath of Fire II               | RPG          | Capcom            | 1994 |
| 25  | Lufia II: Rise of Sinistrals    | RPG          | Neverland         | 1995 |

### Games by Genre

**RPGs (SNES Specialty):**

- Chrono Trigger
- Final Fantasy IV, V, VI
- EarthBound
- Secret of Mana
- Super Mario RPG
- Breath of Fire I & II
- Lufia I & II
- Terranigma (PAL/JP)
- Dragon Quest V & VI (JP)
- Seiken Densetsu 3 (JP)

**Platformers:**

- Super Mario World
- Yoshi's Island
- Donkey Kong Country 1-3
- Mega Man X, X2, X3
- Kirby Super Star
- Super Castlevania IV

**Action:**

- Super Metroid
- The Legend of Zelda: ALttP
- Contra III
- ActRaiser
- Soul Blazer

**Fighting:**

- Street Fighter II series
- Mortal Kombat II
- Killer Instinct
- Teenage Mutant Ninja Turtles: TF

**Racing:**

- Super Mario Kart
- F-Zero
- Top Gear series
- Rock n' Roll Racing

---

## Rare & Valuable Games

### High-Value Titles (North America)

| Title                    | Loose    | CIB       | Notes                   |
| ------------------------ | -------- | --------- | ----------------------- |
| EarthBound               | $200-300 | $600-1000 | Big box, strategy guide |
| Mega Man X3              | $150-250 | $400-700  | Late release            |
| Aero Fighters            | $150-250 | $400-600  | Limited release         |
| Harvest Moon             | $100-180 | $300-500  | Natsume limited run     |
| Wild Guns                | $150-250 | $400-700  | Natsume shooter         |
| Hagane                   | $250-400 | $600-1000 | Blockbuster rental only |
| Pocky & Rocky 2          | $200-350 | $500-800  | Limited release         |
| Zombies Ate My Neighbors | $50-80   | $150-250  | Cult classic            |
| Chrono Trigger           | $120-180 | $300-500  | Square classic          |
| Ninja Gaiden Trilogy     | $100-180 | $300-500  | Compilation             |

### Japan Exclusives Worth Importing

| Title               | Genre      | Notes                   |
| ------------------- | ---------- | ----------------------- |
| Seiken Densetsu 3   | Action RPG | Secret of Mana sequel   |
| Dragon Quest V & VI | RPG        | Classic DQ entries      |
| Fire Emblem series  | Strategy   | 3 entries on SFC        |
| Tactics Ogre        | Strategy   | Before PlayStation port |
| Clock Tower         | Horror     | Point-and-click horror  |
| Treasure Hunter G   | RPG        | Final Square SFC game   |

### PAL Exclusives

| Title           | Notes                 |
| --------------- | --------------------- |
| Terranigma      | Never released in NA  |
| Tintin in Tibet | European platformer   |
| The Smurfs      | Infogrames platformer |

---

## Maintenance & Repair

### Common Issues

| Issue             | Symptom                 | Solution                  |
| ----------------- | ----------------------- | ------------------------- |
| Yellowing plastic | Gray turns yellow/brown | Retrobright treatment     |
| No video/audio    | Blank screen            | Check Multi-Out connector |
| Game won't save   | SRAM battery dead       | Replace cartridge battery |
| Dirty cart slot   | Games won't boot        | Clean 62-pin connector    |
| Controller issues | Buttons not responding  | Clean membrane contacts   |

### Cleaning Procedures

**Cartridge Slot:**

1. Power off, unplug console
2. Use cotton swab with 90%+ IPA
3. Gently clean 62-pin connector
4. Let dry completely before use

**Cartridge Contacts:**

1. Clean with IPA and cotton swab
2. Move from center outward
3. Dry completely before inserting

**Controller Cleaning:**

1. Open controller (security bit needed)
2. Clean membrane contacts with IPA
3. Clean rubber pads if sticky
4. Reassemble and test

### Cartridge Battery Replacement

Many SNES games use CR2032 batteries for saves:

1. Open cartridge (security bit required)
2. Carefully desolder or pry old battery
3. Install tabbed CR2032
4. Solder or tape securely
5. Test save function

**Games requiring battery replacement:**

- All RPGs with save files
- Super Mario World
- Zelda: A Link to the Past
- Donkey Kong Country series
- Most first-party titles with saves

---

## Video Output Guide

### Stock Options

| Output    | Cable            | Quality   | Availability     |
| --------- | ---------------- | --------- | ---------------- |
| RF        | RF switch        | Poor      | Not recommended  |
| Composite | Yellow/Red/White | Average   | Pack-in standard |
| S-Video   | S-Video cable    | Good      | NA consoles only |
| RGB       | SCART cable      | Excellent | All regions      |

### RGB Output

The SNES natively outputs RGB through the Multi-Out:

- PAL consoles: Standard SCART cable
- NA consoles: Multi-Out to SCART adapter
- Best quality from 1-Chip revision

### Best Output Chain

1. **SNES → RGB SCART → RetroTINK 5X → HDMI TV**
2. **SNES → HD Retrovision Component → RetroTINK → HDMI**
3. **SNES → S-Video → RetroTINK 2X → HDMI**

### Upscalers

| Device       | Input       | Quality   | Price |
| ------------ | ----------- | --------- | ----- |
| RetroTINK 5X | RGB/S-Video | Excellent | $300  |
| OSSC         | RGB         | Excellent | $200  |
| RetroTINK 2X | S-Video     | Good      | $130  |
| RAD2X        | Multi-Out   | Good      | $80   |

---

## Modding & Preservation

### Common Mods

**1-Chip PPU Bypass:**

- Some 1-Chip consoles have vertical line issues
- Bypass fix restores clean output

**Region-Free Mod:**

- Remove or bridge lockout tabs
- Play JP games on NA console (or vice versa)
- Note: Some games have software region locks

**S-Video to PAL Consoles:**

- PAL SNES lacks S-Video
- Add S-Video output via mod

**HDMI Mods:**

- Analogue Super Nt (separate console)
- Various internal HDMI mods available

### Flash Carts

| Cart            | Price | Features                        |
| --------------- | ----- | ------------------------------- |
| SD2SNES Pro     | $200+ | Enhancement chip support, MSU-1 |
| FXPak Pro       | $200+ | Same as SD2SNES Pro (rebranded) |
| Super EverDrive | $100  | Basic ROM loading               |

**Note:** SD2SNES/FXPak supports Super FX, SA-1, DSP, Cx4 chips.

---

## Emulation Options

### Official

- **SNES Classic Mini** - 21 built-in games
- **Nintendo Switch Online** - Growing library
- **Wii Virtual Console** - Classic lineup
- **Wii U Virtual Console** - Expanded library

### Software Emulators

| Emulator    | Platform       | Accuracy       | Features                |
| ----------- | -------------- | -------------- | ----------------------- |
| bsnes/higan | PC             | Cycle-accurate | Reference quality       |
| Snes9x      | Multi-platform | High           | Enhancement chips       |
| ZSNES       | PC             | Medium         | Legacy, not recommended |

### FPGA Solutions

| Device            | Accuracy  | Notes                |
| ----------------- | --------- | -------------------- |
| Analogue Super Nt | Excellent | Premium FPGA console |
| MiSTer SNES Core  | Excellent | Multi-platform FPGA  |

---

## History & Legacy

### Development Timeline

| Year | Event                                              |
| ---- | -------------------------------------------------- |
| 1987 | Development begins on "Super Famicom"              |
| 1990 | Super Famicom launches in Japan                    |
| 1991 | SNES launches in North America                     |
| 1992 | PAL launch; Super Mario Kart revolutionizes racing |
| 1993 | Star Fox shows 3D polygon capability               |
| 1994 | DKC showcases pre-rendered graphics                |
| 1995 | Chrono Trigger considered peak JRPG                |
| 1996 | N64 launches, SNES continues strong                |
| 1997 | SNES Jr redesign released                          |
| 1999 | Final NA games released                            |
| 2003 | Production officially ends                         |

### Design Philosophy

Nintendo designed the SNES to:

- Maintain backward compatibility focus (accessories)
- Emphasize color and audio quality over raw speed
- Support cartridge enhancement chips for future-proofing
- Prioritize first-party quality control

### Cultural Impact

- Defined the 16-bit aesthetic
- Established RPG genre prominence in the West
- Pioneered shoulder buttons on controllers
- Mode 7 racing and pseudo-3D became iconic
- Sound chip defined video game music for a generation

---

## Resources

### Official Documentation

- Nintendo Developer Documentation (archived)
- SNES Development Wiki

### Community

- r/snes - Reddit community
- r/retrogaming - General retro
- SNES Central - Comprehensive database
- SNESmusic.org - Audio resources

### Technical Reference

- Fullsnes - Pan Docs equivalent
- Super Famicom Development Wiki
- Anomie's SNES docs

### Price Tracking

- PriceCharting.com
- GameValueNow
- Video Game Price Charts

---

## Quick Reference Card

**Console Facts:**

- Released: November 21, 1990 (JP) / August 23, 1991 (NA)
- Discontinued: 2003
- Units sold: 49.1 million
- Library: 1,757+ games worldwide

**Key Specifications:**

- CPU: 3.58 MHz Ricoh 5A22
- RAM: 128KB + 64KB VRAM + 64KB Audio
- Colors: 32,768 palette, 256 on-screen
- Media: Cartridge (up to 6MB)

**Collecting Priorities:**

1. Working console (1-Chip preferred for video)
2. Two controllers
3. RPG essentials (Chrono Trigger, FF6, EarthBound)
4. First-party Nintendo titles
5. Rare Capcom/Konami releases

---

_Use our [collection tracker](/app) to manage your SNES library._

_See also: [SNES Collecting Guide](./collecting-guide.md) for market analysis and strategies._
