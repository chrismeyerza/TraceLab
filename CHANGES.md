# v1.9.6 — Text-palette readability fix

The five-tier text palette has been lifted across the board. Filter
labels, chip text, table headers, and gauge captions are no longer
washed out against the dark background.

## The problem

The previous dim tiers (`--text-faint: #889189` at ~55% and
`--text-mute: #5a6359` at ~38%) were genuinely hard to read on the
near-black background. Worse, the chip inactive state combined those
dim colours with `opacity: 0.5` — putting effective contrast far below
WCAG AA. That made filter chips, table headers, and gauge captions
read as "disabled" rather than as ordinary UI chrome.

## What's changed

CSS-only change. No JS, no behaviour, no markup affected.

### Three text variables lifted

```diff
- --text-dim:   #b1bbb4   (~72%)
+ --text-dim:   #d0d6d2   (~82%)
- --text-faint: #889189   (~55%)
+ --text-faint: #a8b0aa   (~67%)
- --text-mute:  #5a6359   (~38%)
+ --text-mute:  #888f88   (~53%)
```

### Filter labels, chips, and table headers escalated

These elements were using `--text-faint` (which we already lifted), but
they're interactive/structural controls, not metadata. Bumped to `--text`
(88%) where appropriate.

The chip inactive state had a particularly bad combination of dim colour +
`opacity: 0.5`. Removed the heavy opacity, switched colour to `--text`,
and tightened the border. Active chips unchanged (already high contrast).

## Files changed

`src/index.css` and `package.json` only.

## What you'll see

- Filter row labels (Clubs, Types, Equipment, Tags) — readable now
- Chip text for unselected filter options — clear
- Table column headers across all data tables — properly visible
- Gauge captions ("range X–Y · n = 234") — readable
- Status pills in TopBar — should be noticeably less ghostly

The five-tier hierarchy is preserved — just compressed upward so the
bottom of the range isn't unreadable.

## Apply

This is local-only — no cloud changes needed (the cloud build is
getting the same fix in v0.6.1 separately, since both apps share the
same CSS philosophy).

Branch: `feature/pr1-9-6-text-readability`. Layers on top of 1.9.5.

## What to verify

1. Open the local app
2. Look at any view with filters — labels and inactive chip text should
   be clearly readable
3. Sessions / Shots table column headers — properly visible, not ghostly
4. Flight view gauges — "n = 234" caption underneath should read clearly
