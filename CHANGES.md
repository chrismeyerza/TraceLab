# Changes — Start line classification + severity-driven bucketing (PR 4.10)

A proper rewrite of how shots get classified into shape buckets, addressing
the long-running "but why is this a Pull Hook" question.

## The two problems this fixes

### Problem 1: We were using face direction as the start line

Modern ball-flight law says the ball starts where the **face × 0.75 + path
× 0.25** points (for irons — driver is closer to 0.85/0.15). The old
classifier used face alone, which:
- Overstated PULL for shots with strong in-out paths and slight closed face
- Understated PULL for shots with square face and steep out-in path
- Made the classification disagree with the player's actual experience

### Problem 2: Hook vs Draw was about start direction, not outcome

A "Hook" with a square start and a "Pull Hook" with a left start both end
up well left of target. Both are uncontrolled curves. Both are face-to-path
problems. They're the same coaching diagnosis and produce the same scoring
damage — but the old bucketing put them in different cells.

The grid corners should mean "this is trouble" not "this happens to live
at this axis intersection".

## What's in place now

### 1. `startLine` as a first-class derived field

Computed on import in `parser.js`:

```
startLine = 0.75 × faceToTarget + 0.25 × clubPath
```

Stored on every shot. Robust to old shots without the field (Shots view
computes on the fly from face + path).

### 2. Start line drives PULL / PUSH classification, threshold ±3°

In `classifyShape`:
- `|startLine| < 3°` → STRAIGHT start
- `startLine ≤ −3°` → PULL
- `startLine ≥ +3°` → PUSH

The 3° threshold was chosen because at 150 yards it's ~8 yards offline at
takeoff — meaningfully missing the target line. Tighter than the old 4°,
which is the right call when curve is reinforcing the start direction.

### 3. Severity-driven 9-grid bucketing

The corner cells now own SEVERE curves regardless of start direction:

| Start \ Curve | Severe Draw | Controlled / Straight | Severe Fade |
|---|---|---|---|
| **Pull** | Pull / Hook | Pull | Pull / Slice |
| **Straight** | Draw | Straight | Fade |
| **Push** | Push Draw | Push | Push / Slice |

Three corner renames:
- "Pull Hook" → "**Pull / Hook**" — holds both genuine Pull Hooks and Hooks
- "Pull Slice" → "**Pull / Slice**" — same logic on the other side
- "Push Slice" → "**Push / Slice**" — same logic on the other corner

"Push Draw" keeps its name because it's the constructive "started right,
curved back" shape — different category from the trouble shots.

Bucketing rules now read intuitively: severe curves (|f2p| > 5°) go to
the corner that matches their curve direction. Controlled curves go to
the middle row regardless of start direction. The constructive Push Draw
gets its own positive-shape cell.

### 4. START column in the drill panel

The drill panel now shows START between PATH and F-TO-P. Values exceeding
±3° highlight in amber. Tooltip explains the formula. So when you click
a "Pull / Hook" cell, you can see for each shot whether it started near
target (a Hook) or started left (a true Pull Hook).

### 5. START column in Shots view Club tab

Inserted between FACE→TGT and F→P. Same amber-on-off-target highlighting.

### 6. startLine in the scatter tooltip

Hovering any dot on the Face vs Path scatter now shows the start line too.

## What this means for YOUR data

### Bucket counts (21 shots):

| Bucket | Count | % |
|---|---|---|
| Draw | 7 | 33% |
| Pull / Hook | 6 | 29% |
| Fade | 5 | 24% |
| Straight | 2 | 10% |
| Push | 1 | 5% |

### What's in your Pull / Hook cell now

All 6 shots have severe closed-to-path delivery (f2p < −5°). Looking at
start lines:
- 2 shots are genuine Pull Hook: start −6.4° and −10.9°, severe curves on
  top — these end up 30-50 yards left.
- 4 shots are Hook (granular name): start −0.8° to −3.5°, severe curves.
  These start near/just-left-of target and curve another 20+ yards left.
  All end up well left.

The drill panel shows the granular CLASSIFICATION column, so you can see
which is which. Same cell, same severity of outcome, but distinguishable
when needed.

### Other notable label changes

- 50° at face +3.4° / start +3.27° — was "Straight", now "Push". Started
  +3.3° right of target — that's off the line.
- 7i at face −5.1° / start −3.97° — was "Draw", now "Pull Draw". Pulled
  start with controlled draw curve. Folds to Draw bucket as before.

## Files modified

| File | What changed |
|---|---|
| `src/lib/parser.js` | New derived `startLine` field on every shot |
| `src/lib/shape.js` | `classifyShape` uses startLine; SHAPE_BUCKETS renamed corners; bucketShape rewritten with severity ownership |
| `src/views/ShapeView.jsx` | Drill panel has START column; scatter tooltip shows start; threshold colour at ±3° |
| `src/views/ShotsView.jsx` | New `startLine` column in Club tab with on-the-fly fallback for shots imported before this PR |

## Verified

- Production build clean
- Sanity-tested on your 22-shot dataset — startLine values match the
  formula, classifications adjust as expected with the new threshold
- Old shots without stored startLine show correctly in Shots view (fallback
  computation runs)
- All 6 Pull / Hook shots have face-to-path < −5° AND end up well left of
  target — they belong together

## What's next

Per-shot tagging via club label (was 4.9, deferred to a future PR);
per-club swing fingerprint; user-name-on-import. Same backlog.
