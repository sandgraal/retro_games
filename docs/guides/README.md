# Collector Guides

This directory contains markdown-based collecting guides and console reference pages for SEO and community value.

## Published Guides

### Console Reference Pages

- [NES Reference Guide](./consoles/nes/reference.md) - Technical specs, variants, library highlights
- [SNES Reference Guide](./consoles/snes/reference.md) - 16-bit Nintendo documentation
- [N64 Reference Guide](./consoles/n64/reference.md) - 64-bit era technical documentation
- [GameCube Reference Guide](./consoles/gamecube/reference.md) - Nintendo's compact powerhouse
- [Wii Reference Guide](./consoles/wii/reference.md) - Motion control revolution
- [Game Boy Family Reference](./consoles/gameboy/reference.md) - GB, GBC, GBA documentation
- [Genesis/Mega Drive Reference](./consoles/genesis/reference.md) - Sega's 16-bit powerhouse
- [Saturn Reference Guide](./consoles/saturn/reference.md) - Sega's 32-bit 2D powerhouse
- [Master System Reference Guide](./consoles/mastersystem/reference.md) - Sega's 8-bit challenger
- [Dreamcast Reference Guide](./consoles/dreamcast/reference.md) - Sega's final console
- [Neo Geo Reference Guide](./consoles/neogeo/reference.md) - SNK's arcade-at-home
- [PS1 Reference Guide](./consoles/ps1/reference.md) - Original PlayStation documentation
- [PS2 Reference Guide](./consoles/ps2/reference.md) - Best-selling console documentation
- [PSP Reference Guide](./consoles/psp/reference.md) - Sony's portable powerhouse
- [TurboGrafx-16 Reference Guide](./consoles/turbografx/reference.md) - NEC's CD pioneer

### Console Collecting Guides

- [Dreamcast Collecting Guide](./consoles/dreamcast/collecting-guide.md) - Sega's final console
- [Game Boy Family Collecting Guide](./consoles/gameboy/collecting-guide.md) - GB, GBC, GBA strategy
- [GameCube Collecting Guide](./consoles/gamecube/collecting-guide.md) - Nintendo's compact powerhouse
- [Genesis Collecting Guide](./consoles/genesis/collecting-guide.md) - Sega 16-bit strategy
- [Master System Collecting Guide](./consoles/mastersystem/collecting-guide.md) - Sega 8-bit strategy
- [NES Collecting Guide](./consoles/nes/collecting-guide.md) - 8-bit Nintendo essentials
- [N64 Collecting Guide](./consoles/n64/collecting-guide.md) - Complete Nintendo 64 strategy
- [Neo Geo Collecting Guide](./consoles/neogeo/collecting-guide.md) - SNK premium strategy
- [PS1 Collecting Guide](./consoles/ps1/collecting-guide.md) - PlayStation 1 strategy
- [PS2 Collecting Guide](./consoles/ps2/collecting-guide.md) - Complete PS2 strategy
- [PSP Collecting Guide](./consoles/psp/collecting-guide.md) - Sony portable strategy
- [Saturn Collecting Guide](./consoles/saturn/collecting-guide.md) - Sega 32-bit import haven
- [SNES Collecting Guide](./consoles/snes/collecting-guide.md) - 16-bit Nintendo essentials
- [TurboGrafx-16 Collecting Guide](./consoles/turbografx/collecting-guide.md) - NEC/Hudson strategy
- [Wii Collecting Guide](./consoles/wii/collecting-guide.md) - Motion control era strategy

### Genre Guides

- [RPG Collecting Guide](./genres/rpg/collecting-guide.md) - Cross-platform JRPG/WRPG coverage

### Index Pages

- [Console Reference Library](./consoles/README.md) - Complete console index

### Outreach & Marketing

- [Community Outreach Plan](./outreach-plan.md) - Strategy for community engagement and influencer partnerships

---

## Directory Structure

```
guides/
├── README.md                    # This file
├── templates/
│   ├── console-guide.md         # Template for console collecting guides
│   ├── genre-guide.md           # Template for genre-specific guides
│   └── interview.md             # Template for collector interviews
├── consoles/
│   ├── README.md                # Console library index
│   ├── nes/                     # NES/Famicom guides
│   ├── snes/                    # Super Nintendo guides
│   ├── genesis/                 # Sega Genesis/Mega Drive guides
│   ├── ps2/                     # PlayStation 2 guides
│   └── ...
└── genres/
    ├── rpg/                     # RPG collecting guides
    └── ...
```

## Guide Templates

Each guide follows a structured template to ensure consistency:

### Console Collecting Guides

- Console overview and history
- Notable games and rarities
- Price trends and market analysis
- Collecting tips (variants, regions, etc.)
- Common issues and red flags
- Recommended resources

### Genre Guides

- Genre history and evolution
- Must-have titles by platform
- Hidden gems and underrated picks
- Collecting strategies

### Collector Interviews

- Collector background
- Collection focus and size
- Favorite acquisitions
- Advice for new collectors

## Adding a New Guide

1. Copy the appropriate template from `templates/`
2. Fill in the frontmatter metadata
3. Write content following the template structure
4. Add relevant images to the guide's directory
5. Update the guide index

## Frontmatter Schema

```yaml
---
title: "Guide Title"
slug: "guide-slug"
category: "console|genre|interview"
platform: "PS1|PS2|N64|SNES|etc" # For console guides
genre: "RPG|Action|etc" # For genre guides
author: "Author Name"
date: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
description: "SEO description (150-160 chars)"
image: "path/to/hero-image.jpg"
tags: ["collecting", "retro", "games"]
---
```

## Building Guides

Guides are markdown files that can be:

1. Rendered directly on the site as static pages
2. Processed by a static site generator (11ty, Hugo, Jekyll)
3. Published to a headless CMS

For now, guides live as markdown and can be manually converted to HTML or integrated with a build pipeline as the project grows.
