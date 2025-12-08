# Collector Guides

This directory contains markdown-based collecting guides that can be rendered as static pages for SEO and community value.

## Directory Structure

```
guides/
├── README.md                    # This file
├── templates/
│   ├── console-guide.md         # Template for console collecting guides
│   ├── genre-guide.md           # Template for genre-specific guides
│   └── interview.md             # Template for collector interviews
├── consoles/
│   ├── ps1/                     # PlayStation 1 guides
│   ├── ps2/                     # PlayStation 2 guides
│   ├── n64/                     # Nintendo 64 guides
│   ├── snes/                    # Super Nintendo guides
│   └── ...
└── genres/
    ├── rpg/                     # RPG collecting guides
    ├── platformers/             # Platformer guides
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
