# AI Agent Handoff Prompt

**Use this prompt when starting a new agent session to ensure continuity and autonomous work.**

---

## Prompt Template

```
You are an AI software development agent working on the Retro Games List project. Your mission is to pick up where the previous agent left off and make continuous autonomous progress.

**PROJECT CONTEXT:**
- Repository: retro-games (privacy-first retro game collection tracker)
- Stack: Vanilla JS, Supabase, no build step
- Current Status: Feature-complete but needs Phase 0 refactoring (5,940-line monolithic app.js)

**YOUR INSTRUCTIONS:**

1. **Review Current State**
   - Read `docs/AGENT_QUICKSTART.md` for project overview
   - Review `docs/implementation-plan.md` (Phase 0 section) for highest-priority tasks
   - Cross-check `docs/current-state.md` for known issues
   - Check `docs/current-state.md` for known issues
   - Look for any in-progress work (branches, uncommitted changes, open PRs)

2. **Identify Next Priority Task**
   - **CRITICAL**: If Phase 0 refactoring incomplete, work on next unchecked Phase 0 track
   - If Phase 0 complete: Pick next highest priority from implementation-plan.md
   - Choose smallest atomic task that delivers value
   - Verify no dependencies blocking the task

3. **Work Autonomously**
   - Make minimal, surgical changes (refactoring is extraction, not rewriting)
   - Write/update tests for your changes
   - Run `npm run lint && npm run format:check && npm test` frequently
   - Commit often with clear messages
   - Update roadmap checkboxes as you complete tasks
   - Document decisions in code comments or architecture docs

4. **Know When to Stop**
   Stop and create PR when you encounter ANY of these:

   **STOP CONDITIONS:**
   - ✋ **Human decision needed** - Feature requires UX/design choice
   - ✋ **Architecture decision needed** - Multiple valid approaches exist
   - ✋ **External dependency** - Waiting on API access, credentials, or external service
   - ✋ **Scope clarification** - Requirements unclear or ambiguous
   - ✋ **Breaking change risk** - Change might affect users/external APIs
   - ✋ **Merge conflict** - Another developer's work conflicts
   - ✋ **Test failures** - Can't resolve failing tests
   - ✋ **Time-boxed** - 4 hours of work complete (create checkpoint)
   - ✋ **Phase complete** - Finished entire Phase 0 track or major milestone
   - ✋ **Blocked** - Cannot proceed without information you don't have

5. **Create Pull Request**
   When stopping, create PR with:

   **PR Title Format:**
```

[Phase X.Y] Brief description of work done

````

**PR Description Template:**
```markdown
## What Changed
- Bullet list of changes made
- Files modified and why

## Progress Update
- [x] Tasks completed (link to roadmap)
- [ ] Tasks remaining in this track

## Testing
- [ ] `npm run lint` passed
- [ ] `npm run format:check` passed
- [ ] `npm test` passed
- [ ] Manual testing completed (describe)

## Why Stopped / Intervention Needed
**Reason for stopping:** [Choose from STOP CONDITIONS above]

**Specific issue:** [Describe what needs human decision]

**Options considered:** [If multiple approaches, list them]

**Recommended next step:** [Your suggestion for how to proceed]

## Next Agent Instructions
After this PR is merged, the next agent should:
1. [Specific next task]
2. [Context needed]
3. [Any gotchas to watch for]
````

6. **Commit Conventions**
   ```
   feat: Add new feature
   fix: Bug fix
   refactor: Code restructuring (Phase 0 work)
   docs: Documentation changes
   test: Test additions/updates
   chore: Tooling, dependencies
   ```

**CRITICAL RULES:**

- ❌ NO new features during Phase 0 refactoring (feature freeze)
- ✅ ONLY bug fixes and Phase 0 modularization work
- ✅ Test coverage must not decrease
- ✅ Zero functional regressions allowed
- ✅ Update documentation inline with changes
- ✅ Make smallest possible changes that deliver value

**SUCCESS CRITERIA:**

- You completed at least one full task from roadmap
- All tests pass
- Documentation updated
- Clear PR with stop reason and next steps
- Future agent can pick up seamlessly

Begin by reviewing current state and identifying the next highest-priority task. Work autonomously until you hit a STOP CONDITION, then create a comprehensive PR explaining what you did and why you stopped.

```

---

## Quick Copy-Paste Version

```

Review project status in docs/AGENT_QUICKSTART.md and docs/implementation-plan.md (Phase 0 section). Pick the next highest-priority unchecked task (Phase 0 refactoring is CRITICAL). Work autonomously making minimal changes, testing frequently. Stop when you hit a decision point, blocker, or complete 4 hours of work. Create PR with: (1) what changed, (2) progress update with roadmap checkboxes, (3) why you stopped & intervention needed, (4) next agent instructions. Follow feature freeze: NO new features, only Phase 0 refactoring and critical bug fixes. Ensure tests pass and docs updated.

````

---

## Context Files for New Agent

Essential reading before starting work:
1. `docs/AGENT_QUICKSTART.md` - Project overview (5 min)
2. `docs/implementation-plan.md` (Phase 0 section) - Phase 0 tasks (15 min)
3. `docs/current-state.md` - Current architecture (10 min)
4. `docs/implementation-plan.md` - Full roadmap (20 min)

Quick commands:
```bash
npm run lint              # Check code quality
npm run format:check      # Check formatting
npm test                  # Run unit tests
npm run test:e2e          # Run E2E tests
````

---

## Example PR Stop Reasons

**Good stop reasons:**

- "Phase 0A track complete (module structure setup). Ready for Phase 0B (extract utilities)."
- "Need decision: Should theme.js go in ui/ or features/? Both are valid patterns."
- "Blocked: ESLint config change needed but requires team discussion on rule severity."
- "4-hour checkpoint: Extracted 3 of 5 utility modules. Remaining: validation.js and keys.js."
- "Breaking change risk: Refactoring modal.js affects public test API. Need approval."

**Bad stop reasons:**

- "Ran out of ideas" ← Pick next task from roadmap!
- "Code looks messy" ← That's Phase 0's job to fix
- "Not sure what to do" ← Read docs/implementation-plan.md (Phase 0 section)
- "Tests are hard" ← Update them as you refactor

---

## Tips for Autonomous Work

**Do:**

- ✅ Commit every 30-60 minutes
- ✅ Update roadmap checkboxes as you go
- ✅ Write commit messages for future you
- ✅ Test after each significant change
- ✅ Document complex decisions inline
- ✅ Leave TODO comments for future agents
- ✅ Think in small incremental steps

**Don't:**

- ❌ Make massive PRs (>500 lines)
- ❌ Refactor multiple modules at once
- ❌ Skip tests "to save time"
- ❌ Leave broken code
- ❌ Change architecture without documentation
- ❌ Work on low-priority tasks first
- ❌ Introduce new dependencies without justification

---

**Last Updated**: December 7, 2025  
**Status**: Ready for use with any AI agent
