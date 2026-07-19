---
name: close-session
description: Wrap up a working session — write the dated session log, refresh the live current-state doc, extract any durable memories, then offer to commit. Use when the user says "close the session", "wrap up", "log this session", "end of session", or is stopping work for the day.
---

# Close Session

End a working session in these steps. Each artifact has a home that already
defines its format and rules — follow those, don't restate them here.

1. **Write the session log.** Follow the template, naming, and conventions in
   [docs/sessions/README.md](../../../docs/sessions/README.md). Add a new file;
   never edit past ones.

2. **Refresh the live status.** Update [docs/current-state.md](../../../docs/current-state.md)
   — the single home for "where we are" (bump its date; revise phase / done /
   open questions / next steps). Don't copy status into the session log; link.

3. **Extract candidate memories — ask before persisting.** Review the session for
   durable, reusable facts _not already written down_: user or working-style
   preferences, project constraints, external references. **Propose them to the
   user and persist only the ones they approve**, each in its correct single home:
   project facts in-repo (`CLAUDE.md` / `docs/`), cross-project working
   preferences in global `~/.claude/CLAUDE.md`. This project keeps memory
   **in-repo** — auto-memory is off; never write to the external auto-memory
   store. Skip anything already captured, and never persist personal info the
   Visibility/Privacy rules bar.

4. **Offer to commit.** Show `git status`, then commit the docs if the user wants.

Honor the conventions and the Visibility/Privacy rules in
[CLAUDE.md](../../../CLAUDE.md) and the global git rules — they already say what
applies; this skill just sequences the wrap-up.
