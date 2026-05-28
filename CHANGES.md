# Changes — User identity & profiles (PR 4.12)

First-class user profiles. Each shot is now attributed to a specific person.
Unlocks future features (per-user analysis, multi-user households, cloud
sync) without changing how the app feels for solo use.

## What this adds

### A new user concept

Every user has:

- **Name** (required)
- **Handicap** (0-54, optional)
- **Dominant hand** (RH / LH) — drives Shape view classification orientation;
  lefties now get correctly-mirrored draw/fade labels for free

Stored in localStorage (not IndexedDB) because they're small, rarely
change, and need to be available synchronously at app boot. The active
user id is also persisted there.

### First-launch flow

If there are no users when the app starts, a non-dismissable modal opens:

> **Welcome to TraceLab**
> Set up your profile to get started. You can add more users later.
>
> [Name input]
> [Handicap input — optional 0-54]
> [Dominant hand: RH / LH chips]
>
> [Get started]

Once submitted, the user becomes active and **all existing shots in
IndexedDB get backfilled** to attribute them to this user. So on your
upgrade, your 22 existing shots become "Chris Meyer's shots" the moment
you fill in the modal.

### Gear icon → Settings panel

New gear icon in the TopBar (between the LATEST stat pill and the right
edge). Click it to open the Settings popover. Currently houses just the
user list — but it's the right home for any future global preferences.

Active user's name now appears as a small label in the TopBar to its
left, so you always know which profile you're operating as.

### Adding & editing users

In the Settings panel:

- **Click any user row** → switch active user
- **Click the ✎ icon** → edit that user (same fields as creation)
- **Click the × icon** → delete user. (Disabled on the last user — would
  leave shots orphaned. Note that delete does NOT cascade-delete shots —
  the shots remain in IndexedDB with a now-orphaned userId. Deliberate;
  cascade-delete would be a destructive surprise.)
- **+ Add user** button → opens the same modal in `add` mode

### Import attribution

When importing a CSV / XLSX file with the new system:

- **Single-user case** (just Chris): no prompt. Shots auto-attributed.
- **Multi-user case**: an attribution modal appears between parse and
  store, defaulting selection to the active user (the common case).
  Options: pick an existing user, create a new one inline, or cancel.

The "Create new user" path is wired in: it opens the AddUser modal with
the pending import paused, then auto-commits the import to the newly
created user when they submit.

### Per-user right-handedness

`rightHanded` is no longer a hardcoded `useState(true)` at the App level.
It's now derived from the active user's profile, so:

- Switching from a RH user to a LH user (or vice versa) automatically
  remirrors Shape classification — draws and fades flip as you'd expect
- Lefties get a correct view of their swing pattern for the first time

## What this does NOT change

- **No user names displayed in tables yet.** When you only have one user,
  surfacing the name everywhere would be visual noise. Once you have
  multiple users, future PRs can add a user filter row alongside Clubs /
  Time / Pinned Session.
- **Storage path unchanged.** Shots still live in IndexedDB; userId is just
  a new field on each shot record. Backwards compatible: existing shots
  without userId still load and display correctly until backfilled.
- **Export/Import for backups already round-trips userId** by virtue of
  preserving all shot fields. So PR 4.11 backups made before PR 4.12 will
  import as expected (with shots needing backfill); backups made after
  will round-trip cleanly.
- **No CSS rebuild.** Just incremental modal/settings styles added.

## Files modified

| File | What changed |
|---|---|
| `src/lib/users.js` | **NEW** — full user-management module (CRUD + active-user state + shot-backfill helper) |
| `src/components/UserModal.jsx` | **NEW** — modal for first-launch / add / edit. Three modes from one component |
| `src/components/SettingsPanel.jsx` | **NEW** — gear-anchored popover with user list & actions |
| `src/components/ImportUserModal.jsx` | **NEW** — attribution prompt for multi-user imports |
| `src/components/TopBar.jsx` | Adds gear button, active-user display, version bump (1.2 → 1.3) |
| `src/App.jsx` | User state management, first-launch flow, attribution flow, per-user rightHanded |
| `src/index.css` | Modal overlay styles, settings panel styles, gear button styles, form-row styles, btn-primary class |

## Verified

- Production build clean (~5 KB extra CSS, ~6 KB extra JS for the new
  modules)
- Smoke-tested users module in isolation: CRUD all works, active-user
  defaults sensibly, last-user delete refused, backfill idempotent
- Manual code review: every user-derived value (rightHanded) flows
  through React state so user switches re-render relevant views

## Practical experience on first run

After applying:

1. App loads, you see "Welcome to TraceLab" modal
2. Type your name, handicap (12.4 or whatever), click RIGHT-HANDED
3. Click "Get started"
4. Your 22 existing shots become attributed to you
5. From here it looks identical to before — you're the only user, no
   prompts, no extra UI noise

If you create a second user later (testing your spouse / a teaching pro
demo / yourself before/after lessons), the gear menu becomes more
visible, and CSV imports start prompting for attribution.

## What's next

PR 4.13 — shot-type + equipment tagging (your wedge-as-pitch-vs-full
problem). Two new orthogonal fields on every shot, with bulk-tag UI for
selecting a range of shots from a session.
