---
name: startup
description: Start-of-session bootstrap
disable-model-invocation: true
---

Start this session. Follow this exact order:

1. Check git status — what branch, any uncommitted changes?
2. Start the dev server (`npm run dev`) in the background
3. Read the latest CLAUDE.md for session context
4. Check the app's Wishlist for tasks marked **In Progress** or **Planned**
5. If tasks found — summarize them and recommend what to pick up
6. If none found — review CLAUDE.md "Next Session Priority" and recommend what to work on
7. Brief me: branch, dev server status, and recommended next task
