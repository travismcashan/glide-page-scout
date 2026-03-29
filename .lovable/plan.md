

## Problem

On mobile, users encounter two competing hamburger menus:
1. **Top-right**: Global nav (slides in from right) — pages like Chat, Knowledge, Sites, Groups, etc.
2. **Below header on chat page**: Chat thread nav (slides in from left) — thread list with rename/pin/delete

Two hamburgers in different corners, opening from opposite sides, is disorienting. Users can't build muscle memory for "the menu button."

## Recommended approach: Merge into one left-side drawer

The cleanest mobile UX pattern (used by Slack, Discord, Gmail, ChatGPT) is a **single left-side drawer** that combines both levels of navigation:

```text
┌──────────────────────────┐
│  [Logo]  Thread Title  [+]│  ← slim top bar (always visible)
├──────────────────────────┤
│                            │
│   Chat messages...         │
│                            │
│   [Input bar]              │
└──────────────────────────┘

Tap hamburger (left) → single drawer opens:

┌─────────────────┐
│  Global Nav      │  ← Chat · Knowledge · Sites · Groups...
│─────────────────│
│  Recent Chats    │  ← thread list (only when on /chat)
│   Thread 1       │
│   Thread 2       │
│   Thread 3       │
│─────────────────│
│  👤 User · Settings · Sign Out │
└─────────────────┘
```

### Key design decisions

1. **One hamburger, top-left** — replaces both current hamburgers. The global header's right-side hamburger is removed on mobile; instead, the MobileChatDrawer's left hamburger becomes the single entry point.

2. **Drawer contents are contextual** — When on `/chat`, the drawer shows global nav links at the top, then the thread list below. On any other page, it just shows global nav + user section (same as current right-side menu, just moved left).

3. **Thread title stays in the top bar** — The slim bar with thread title and [+] new-thread button remains visible, so the user always knows which thread they're in.

4. **No second hamburger** — The AppHeader on mobile drops its own Sheet/hamburger entirely. Instead it renders a compact bar with just the left hamburger trigger and maybe the avatar.

### Files to change

| File | Change |
|------|--------|
| `src/components/chat/MobileChatDrawer.tsx` | Add global nav links (from NAV_ITEMS) at the top of the drawer, above "Recents." Add user info / sign-out section at the bottom. |
| `src/components/AppHeader.tsx` | On mobile when on `/chat` route: hide the hamburger + Sheet entirely (the MobileChatDrawer handles it). On other routes: move the hamburger to the left side and open the Sheet from the left. |
| `src/components/AppHeader.tsx` | Unify the mobile Sheet to open from the left (`side="left"`) on all pages for consistency. |

### Why this works
- **One mental model**: "Menu is always top-left" — matches iOS/Android conventions
- **No lost functionality**: Global nav, thread list, user profile, sign out — all in one place
- **Contextual sections**: Thread list only appears when relevant (on chat page)
- **Familiar pattern**: This is exactly how ChatGPT, Slack, and the Lovable app itself handle it

