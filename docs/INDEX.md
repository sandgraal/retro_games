# Documentation Index

_Last updated: January 2025_

## 📚 Documentation Overview

This project maintains comprehensive documentation for developers, contributors, and AI coding agents.

## Core Documentation

### Getting Started

- **[README.md](../README.md)** - Project overview, features, quick setup
- **[docs/setup.md](./setup.md)** - Detailed setup instructions
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines, PR checklist

### Architecture & Technical

- **[docs/architecture.md](./architecture.md)** ⭐ **START HERE** - Complete architecture documentation
  - File structure and module organization
  - **27 ES6 modules** with detailed exports
  - Design system (colors, typography, components)
  - Data flow and state management
  - Performance considerations
  - Browser support and accessibility

- **[docs/current-state.md](./current-state.md)** - Current status and next steps
  - What's working
  - Known gaps and next priorities
  - Module inventory with line counts

- **[docs/data-pipeline.md](./data-pipeline.md)** - Database schema and Supabase integration
  - Table structure
  - Migrations
  - Data seeding

### Planning & Roadmap

- **[docs/implementation-plan.md](./implementation-plan.md)** - Full project roadmap
  - Phase 0: Architecture Redesign ✅ COMPLETE (January 2025)
  - Phase 1: Foundation Hardening ✅ COMPLETE
  - Phase 2-4: Future features
  - Track-based organization

- **[docs/image-sourcing.md](./image-sourcing.md)** - Cover art and media guidelines
  - Trusted sources
  - Seeding process
  - Storage best practices

- **[docs/recovery-playbook.md](./recovery-playbook.md)** - Emergency procedures
  - Rollback procedures
  - Backup restoration
  - Incident response

### For AI Agents

- **[docs/AGENT_QUICKSTART.md](./AGENT_QUICKSTART.md)** - Quick onboarding for AI coding agents
  - Project status at a glance
  - Required reading priority
  - What to work on
  - Architecture overview

- **[.github/copilot-instructions.md](../.github/copilot-instructions.md)** - Detailed coding patterns
  - Project overview
  - Data architecture
  - File responsibilities
  - Critical code patterns
  - Build and test commands
  - Conventions and anti-patterns

## Content & Guides

- **[docs/guides/](./guides/)** - Collector guides and content templates
  - [guides/README.md](./guides/README.md) - Guide structure and workflow
  - [guides/templates/](./guides/templates/) - Templates for new content
    - `console-guide.md` - Console collecting guide template
    - `genre-guide.md` - Genre-focused guide template
    - `interview.md` - Collector interview template
  - [guides/consoles/](./guides/consoles/) - Console-specific guides
    - [ps2/collecting-guide.md](./guides/consoles/ps2/collecting-guide.md) - PlayStation 2 collecting guide

## Testing & Evaluation

- **[evaluation/README.md](../evaluation/README.md)** - Automated testing framework
  - Test coverage overview
  - Running tests
  - Evaluation metrics

- **[tests/](../tests/)** - Test files
  - `utils.test.js` - Module unit tests (460 tests)
  - `app.test.js` - Integration tests (25 tests)
  - `archive-media.test.js` - Media archival tests (3 tests)
  - `e2e/*.spec.js` - End-to-end tests

## Context & History

- **[docs/archive/](./archive/)** - Historical documentation
  - `documentation-review-2025-12.md` - December 2025 doc review
  - `phase-1-2-audit.md` - Earlier phase audit
  - `README.md` - Archive index

## Quick Navigation by Role

### 👨‍💻 New Developer

1. Start: [README.md](../README.md) → [setup.md](./setup.md)
2. Architecture: [architecture.md](./architecture.md)
3. Patterns: [.github/copilot-instructions.md](../.github/copilot-instructions.md)
4. Contribute: [CONTRIBUTING.md](../CONTRIBUTING.md)

### 🤖 AI Coding Agent

1. Start: [AGENT_QUICKSTART.md](./AGENT_QUICKSTART.md)
2. Deep dive: [architecture.md](./architecture.md)
3. Patterns: [.github/copilot-instructions.md](../.github/copilot-instructions.md)
4. Status: [current-state.md](./current-state.md)

### 📋 Project Manager

1. Status: [current-state.md](./current-state.md)
2. Roadmap: [implementation-plan.md](./implementation-plan.md)
3. Architecture: [architecture.md](./architecture.md)

### 🎨 Designer

1. Design system: [architecture.md](./architecture.md#design-system)
2. Components: [architecture.md](./architecture.md#ui-components)
3. Style files: `style/tokens.css`, `style/components/*.css`

## Documentation Maintenance

### When to Update

- **After major features**: Update architecture.md and current-state.md
- **After releases**: Update implementation-plan.md progress
- **Code pattern changes**: Update copilot-instructions.md
- **Setup changes**: Update setup.md and README.md
- **Always**: Keep current-state.md synchronized with codebase

### Documentation Standards

- Use clear, concise language
- Include code examples where helpful
- Keep file paths absolute and current
- Date-stamp major updates
- Archive outdated docs to `docs/archive/`
- Cross-reference related documentation

## Recently Updated (January 2025)

✅ Complete documentation overhaul reflecting Phase 0 completion:

- Updated `architecture.md` - Complete 27-module inventory with exports
- Updated `current-state.md` - Phase 0 complete, accurate module metrics
- Updated `implementation-plan.md` - All Phase 0 tracks marked complete
- Updated `AGENT_QUICKSTART.md` - Current architecture and priorities
- Updated `CONTRIBUTING.md` - Feature freeze lifted
- Updated `.github/copilot-instructions.md` - Full module documentation
- Updated this index document

## Documentation Maintenance

### When to Update

- **After major features**: Update architecture.md and current-state.md
- **After releases**: Update implementation-plan.md progress
- **Code pattern changes**: Update copilot-instructions.md
- **Setup changes**: Update setup.md and README.md
- **Always**: Keep current-state.md synchronized with codebase

### Documentation Standards

- Use clear, concise language
- Include code examples where helpful
- Keep file paths absolute and current
- Date-stamp major updates (use "January 2025" format)
- Archive outdated docs to `docs/archive/`
- Cross-reference related documentation

**Redesign Docs** (superseded by architecture.md):

- `REDESIGN_README.md`
- `REDESIGN_SUMMARY.md`
- `REDESIGN_IMPLEMENTATION_GUIDE.md`
- `REDESIGN_QUICK_START.md`
- `REDESIGN_MIGRATION_CHECKLIST.md`

**Outdated Plans** (superseded by current-state.md):

- `refactoring-roadmap.md` - Redesign replaced this approach

**Redundant Evaluation Docs** (consolidated into evaluation/README.md):

- `START_HERE.md`
- `INDEX.md`
- `QUICK_REFERENCE.md`
- `SETUP_GUIDE.md`
- `IMPLEMENTATION_SUMMARY.md`

---

**Questions?** Check [current-state.md](./current-state.md) for immediate priorities or [architecture.md](./architecture.md) for technical details.
