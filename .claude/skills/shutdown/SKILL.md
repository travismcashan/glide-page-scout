---
name: shutdown
description: End-of-session shutdown checklist
disable-model-invocation: true
---

Shut down this session. Follow this exact order:

1. Flag anything preventing clean shutdown
2. Stop the dev server
3. Summarize what was built, changed, or decided
4. List unresolved issues or loose ends
5. Update CLAUDE.md **in the repo** (not ~/.claude) with context the next session needs
6. Add unfinished tasks as wishlist items in the app
7. Commit all changes (including CLAUDE.md updates)
8. Merge worktree branch into main and push to origin
9. Deploy any modified-but-undeployed edge functions
10. Remind me to run AI Prioritize in the app
11. Confirm no work will be lost. If confirmed, reply in bold all-caps that the session can be archived
12. Give me a 3-5 word session name for archiving
