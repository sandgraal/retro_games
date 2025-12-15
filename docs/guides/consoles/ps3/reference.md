---
title: "PlayStation 3 Technical Reference"
slug: "ps3-reference"
category: "console"
platform: "PS3"
author: "Retro Games Hub"
date: "2025-12-14"
updated: "2025-12-14"
description: "Complete technical reference for the Sony PlayStation 3 - hardware specifications, model variants, and system capabilities for the HD gaming era."
image: "ps3-hero.jpg"
tags:
  [
    "reference",
    "PS3",
    "PlayStation 3",
    "Sony",
    "seventh generation",
    "HD gaming",
    "Blu-ray",
  ]
---

# PlayStation 3 Technical Reference

_Last updated: December 2025_

## Introduction

The PlayStation 3 launched in 2006 as Sony's third home console, introducing Blu-ray gaming, the Cell processor, and free online play. Despite a troubled launch, the PS3 became home to some of gaming's most celebrated exclusives and remains a capable system for gaming and media.

---

## Hardware Specifications

### Core System (Cell Processor)

| Component         | Specification                            |
| ----------------- | ---------------------------------------- |
| **CPU**           | Cell Broadband Engine @ 3.2 GHz          |
| **PPE**           | 1 PowerPC core, 2 threads                |
| **SPEs**          | 7 usable (8 total, 1 disabled for yield) |
| **GPU**           | RSX Reality Synthesizer @ 550 MHz        |
| **VRAM**          | 256 MB GDDR3                             |
| **System RAM**    | 256 MB XDR                               |
| **Total Memory**  | 512 MB                                   |
| **Optical Drive** | Blu-ray (2x-8x), DVD (8x), CD (24x)      |

### CPU Details (Cell)

The Cell processor was revolutionary but challenging:

| Component | Specification                             |
| --------- | ----------------------------------------- |
| PPE       | Dual-thread PowerPC core, general purpose |
| SPE       | 6 available to games (1 reserved for OS)  |
| SPE Speed | 256 GFLOPS total (theoretical)            |
| Design    | RISC architecture, 256KB local store/SPE  |

### GPU Details (RSX)

| Specification     | Details                   |
| ----------------- | ------------------------- |
| Architecture      | NVIDIA G70/G71 derivative |
| Clock Speed       | 550 MHz                   |
| Shader Processors | 24 vertex, 24 fragment    |
| Memory Bus        | 128-bit GDDR3             |
| Fill Rate         | 8.8 billion pixels/second |
| HDMI              | 1.3a (1080p support)      |

### Memory Architecture

| Type  | Size   | Bus     | Bandwidth | Purpose       |
| ----- | ------ | ------- | --------- | ------------- |
| XDR   | 256 MB | 128-bit | 25.6 GB/s | System memory |
| GDDR3 | 256 MB | 128-bit | 22.4 GB/s | Video memory  |

---

## Model Variants

### Launch Models (2006-2007)

| Model        | HDD  | Backward Compat | Wi-Fi | Card Reader | Price at Launch |
| ------------ | ---- | --------------- | ----- | ----------- | --------------- |
| CECHA/B (JP) | 20GB | Full (EE+GS)    | Yes   | Yes         | ¥49,980/¥59,980 |
| CECHA01 (US) | 60GB | Full (EE+GS)    | Yes   | Yes         | $599            |
| CECHB01 (US) | 20GB | Full (EE+GS)    | No    | No          | $499            |
| CECHC0x (EU) | 60GB | Partial (GS)    | Yes   | Yes         | €599/£425       |
| CECHE0x      | 80GB | Partial (GS)    | Yes   | Yes         | $499            |

**Backward Compatibility:**

- **Full (EE+GS)**: Hardware PS2 chip - best compatibility
- **Partial (GS)**: Software emulation - ~80% compatible
- **None**: No PS2 support (most models)

### Slim Models (2009-2012)

| Model     | HDD       | Backward Compat | Size Reduction | Notes         |
| --------- | --------- | --------------- | -------------- | ------------- |
| CECH-20xx | 120GB     | None            | 33% smaller    | First Slim    |
| CECH-21xx | 120GB     | None            | Same           | Revised       |
| CECH-25xx | 160/320GB | None            | Same           | Updated drive |
| CECH-30xx | 160/320GB | None            | Same           | Revised       |

### Super Slim Models (2012-2017)

| Model          | HDD          | Backward Compat | Notes               |
| -------------- | ------------ | --------------- | ------------------- |
| CECH-40xx      | 12/250/500GB | None            | Top-loading Blu-ray |
| CECH-42xx/43xx | Various      | None            | Final revisions     |

### Model Identification

| Model Prefix | Type         | Weight | Power    |
| ------------ | ------------ | ------ | -------- |
| CECHAxxxx    | Launch/"Fat" | 5 kg   | 200-280W |
| CECH-2xxxx   | Slim         | 3.2 kg | 250W     |
| CECH-3xxxx   | Slim         | 3.2 kg | 200W     |
| CECH-4xxxx   | Super Slim   | 2.1 kg | 190W     |

---

## Video Output

### Display Capabilities

| Resolution | Format  | Notes                             |
| ---------- | ------- | --------------------------------- |
| 480i/480p  | SD      | Full support                      |
| 720p       | HD      | Native for many games             |
| 1080i      | HD      | Supported                         |
| 1080p      | Full HD | Native or upscaled                |
| 3D         | 720p    | Via HDMI 1.4 (requires FW update) |

### Connection Types

| Output         | Models   | Quality   | Max Resolution |
| -------------- | -------- | --------- | -------------- |
| HDMI           | All      | Best      | 1080p          |
| Component      | All      | Excellent | 1080p          |
| Composite (AV) | All      | Lowest    | 480i           |
| S-Video        | Fat only | Good      | 480i           |
| D-Terminal     | Fat only | Excellent | 1080i          |

### Recommended Setup

**For HD Gaming:**

1. HDMI cable (standard 1.4 or better)
2. Set to 720p/1080p based on display
3. Enable RGB Full Range if supported
4. Game Mode on TV (reduce latency)

---

## Audio Output

### Audio Capabilities

| Format        | Support                   |
| ------------- | ------------------------- |
| PCM           | Up to 7.1 channel         |
| Dolby Digital | 5.1 via HDMI/Optical      |
| DTS           | 5.1 via HDMI/Optical      |
| Dolby TrueHD  | Bitstream via HDMI        |
| DTS-HD MA     | Bitstream via HDMI        |
| LPCM          | 7.1 uncompressed via HDMI |

### Connection Options

| Output   | Max Channels | Quality    |
| -------- | ------------ | ---------- |
| HDMI     | 7.1          | Lossless   |
| Optical  | 5.1          | Compressed |
| AV Multi | 2.0          | Stereo     |

---

## Storage

### Hard Drive

| Aspect       | Details                           |
| ------------ | --------------------------------- |
| Type         | 2.5" SATA (all models)            |
| Interface    | SATA I (1.5 Gbps)                 |
| Upgradeable  | Yes, any 2.5" SATA (9.5mm height) |
| Maximum Size | 1TB officially, 2TB possible      |
| Encryption   | Yes (tied to console)             |

**HDD Upgrades:**

- Any standard 2.5" SATA drive works
- SSD provides faster load times
- Data is encrypted - must backup to USB first
- 9.5mm height limit for Fat/Slim, 12mm for Super Slim (with adapter)

### External Storage

| Feature       | Support                    |
| ------------- | -------------------------- |
| USB drives    | FAT32 only, 4GB file limit |
| Media         | Photos, Music, Videos      |
| Game installs | Internal HDD only          |
| Saves         | Copy to USB (most games)   |

---

## Game Formats

### Physical Media

| Format       | Details                   |
| ------------ | ------------------------- |
| Blu-ray      | Up to 50GB dual-layer     |
| BD-ROM       | Standard game format      |
| Install Size | 0-50GB required HDD space |

### Digital Content

| Type         | Storage | Notes                       |
| ------------ | ------- | --------------------------- |
| PSN Games    | HDD     | Full games, tied to account |
| PS1 Classics | HDD     | Downloadable PS1 games      |
| PS2 Classics | HDD     | Limited library, emulated   |
| Demos        | HDD     | Free downloads              |

---

## Backward Compatibility

### PS1 Compatibility

**All PS3 models** play PS1 games:

- Physical discs work
- PSN downloads available
- Upscaling to HD
- Virtual memory cards (internal)

### PS2 Compatibility

| Model        | Compatibility | Method                      |
| ------------ | ------------- | --------------------------- |
| CECHA/B      | Full          | Hardware (EE+GS chips)      |
| CECHC/E      | Partial       | Software+Hardware (GS only) |
| All others   | None          | No PS2 support              |
| PS2 Classics | Selected      | PSN downloads (all models)  |

**PS2 Compatible Model Checklist:**

- CECHA01 (60GB US) - Best
- CECHB01 (20GB US)
- CECHC0x (60GB EU)
- CECHE0x (80GB)

---

## Controller

### DualShock 3 / SIXAXIS

| Specification | Details                             |
| ------------- | ----------------------------------- |
| Connection    | Bluetooth 2.0, USB charging         |
| Buttons       | D-pad, 4 face, 4 shoulder, 2 sticks |
| Motion        | Six-axis motion sensing             |
| Vibration     | DualShock 3 only (not SIXAXIS)      |
| Battery       | 570mAh, ~30 hours                   |
| Sync          | Up to 7 controllers                 |

### Other Controllers

| Controller            | Notes                         |
| --------------------- | ----------------------------- |
| PS Move               | Motion controller with camera |
| Navigation Controller | For use with Move             |
| Racing Wheels         | Various third-party           |
| Arcade Sticks         | Fighting game controllers     |

---

## Network Features

### PlayStation Network (PSN)

| Feature     | Details                     |
| ----------- | --------------------------- |
| Online Play | Free (unlike Xbox Live)     |
| Store       | Digital games, DLC, add-ons |
| Trophies    | Achievement system (2008+)  |
| Friends     | Up to 100                   |
| Messages    | Text and voice              |

### Current Status (2025)

| Service            | Status                |
| ------------------ | --------------------- |
| PS Store           | Active (browser only) |
| Online multiplayer | Varies by game        |
| Software updates   | Final: 4.91           |
| Account creation   | Still possible        |

---

## Special Features

### Media Capabilities

| Feature          | Support                 |
| ---------------- | ----------------------- |
| Blu-ray playback | Full support            |
| DVD playback     | Full support, upscaling |
| CD playback      | Full support            |
| DLNA streaming   | Media server support    |
| USB media        | Photos, music, video    |

### Other OS

**Linux Support:**

- Available on early firmware (until 3.21)
- Removed in 2010 update
- CFW restores functionality

### 3D Gaming

- Supported via firmware update
- Requires 3D display
- ~100 games with 3D support
- Generally 720p in 3D mode

---

## Known Issues

### Hardware Problems

| Issue                 | Affected Models | Solution             |
| --------------------- | --------------- | -------------------- |
| YLOD (Yellow Light)   | Fat models      | Reflow/reball (temp) |
| Overheating           | Fat models      | Thermal paste, fans  |
| Blu-ray drive failure | All             | Drive replacement    |
| HDMI port issues      | All             | Port replacement     |
| Power supply failure  | Fat models      | PSU replacement      |

### Software Issues

| Issue                 | Solution                    |
| --------------------- | --------------------------- |
| PSN sign-in errors    | Check PSN status            |
| Trophy sync problems  | Try rebuilding database     |
| Slow downloads        | Use wired connection        |
| Game install failures | Rebuild database, check HDD |

### YLOD Prevention

Tips to avoid the Yellow Light of Death:

- Keep ventilation clear (10cm sides)
- Clean dust regularly
- Replace thermal paste
- Avoid enclosures
- Use horizontal position

---

## System Specifications Summary

### Quick Reference

| Specification  | Details                         |
| -------------- | ------------------------------- |
| CPU            | Cell @ 3.2 GHz                  |
| GPU            | RSX @ 550 MHz                   |
| RAM            | 512 MB total                    |
| Storage        | HDD (varies), 2.5" SATA         |
| Max Resolution | 1080p                           |
| Media          | Blu-ray, DVD, CD                |
| Controllers    | DualShock 3 / SIXAXIS           |
| Connectivity   | Wi-Fi, Bluetooth, USB, Ethernet |

### Model Comparison

| Feature             | Fat          | Slim     | Super Slim  |
| ------------------- | ------------ | -------- | ----------- |
| PS2 Backward Compat | Some models  | No       | No          |
| Card Reader         | Some models  | No       | No          |
| USB Ports           | 4 (early), 2 | 2        | 2           |
| Power Consumption   | 200-280W     | 200-250W | 190W        |
| Size                | Largest      | Medium   | Smallest    |
| Noise               | Loudest      | Moderate | Quietest    |
| Disc Load           | Slot         | Slot     | Top-loading |

---

_The PlayStation 3's complex architecture resulted in a system that was difficult to develop for but capable of remarkable experiences. Understanding its hardware variants is essential for collectors._
