# Welcome Reveal and Geist Typography

**Date:** 2026-09-02
**Amended:** 2026-09-03 — center the welcome and cube as one composition
**Status:** Approved design; ready for implementation planning

## 1. Summary

Add one visible DOM heading, `Welcome`, above the cube on the landing page. On a fresh
landing-page load, the heading waits for the 3.5-second cube entrance to finish, then fades
and rises into view through a clipped reveal. It remains visible and stationary while the
cube continues its independent idle bob.

The heading and the cube form one vertically centered composition at rest. The cube is
smaller than the current landing cube, and a responsive gap separates it from the heading.
The cube's responsive landing position, rather than the cube alone, centers the composition.

The heading is not a Three.js object. It is ordinary HTML, does not track the cube, and does
not participate in raycasting or pointer input.

Adopt Geist Sans as the primary typeface across the entire site. Self-host the official
variable webfont so the site has no runtime dependency on a font CDN or external service.

## 2. Goals

- Give the completed landing entrance a clear, designed welcome moment.
- Preserve the minimal, geometric, achromatic direction.
- Center the heading and settled cube together as one visual group at every supported aspect.
- Make the landing cube smaller and separate it from the heading with a deliberate,
  responsive gap.
- Make the reveal feel connected to the entrance rather than like a separate delayed event.
- Keep the heading motionless after its reveal; the cube's idle float remains independent.
- Apply a sleeker, more design-led typeface consistently across landing and content routes.
- Preserve cube interaction, navigation, accessibility, deep-link behavior, and the existing
  blank WebGL-failure fallback.

## 3. Non-goals

- No 3D text, text geometry, texture, sprite, canvas text, or cube-face label.
- No second 3D object and no change to the Three.js scene graph.
- No change to the cube entrance duration, easing curves, spin, resting yaw or pitch, float
  amplitude or period, drag, picking, dock timing or yaw, or routing. This amendment changes
  camera framing, the responsive landing Y-position, and the float's overlap onset only.
- No subtitle, introduction copy, call to action, visible menu, or additional landing text.
- No staggered character animation, blur effect, or perpetual text motion.
- No redesign of content-page hierarchy, size, spacing, color, or copy beyond adjustments
  strictly required to prevent regressions caused by Geist's font metrics.
- No font CDN, Google Fonts request, or framework-specific font package.

## 4. Copy and visual direction

The heading text is exactly:

> Welcome

It has no punctuation. It uses the existing dark neutral foreground color and introduces no
blue accent. It is horizontally centered and reads as one large, lean display line.

Starting typography values:

| Property | Value |
| --- | --- |
| Family | `Geist`, with the existing system stack as fallback only |
| Weight | `450` |
| Size | `clamp(3rem, min(16vw, 16vh), 10rem)` |
| Line height | `0.9` |
| Letter spacing | `-0.045em` |
| Color | Existing `#2a2c30` foreground |
| Alignment | Center |
| Wrapping | None |

These are implementation defaults, not permission to reduce the heading to ordinary body or
UI scale. Any responsive adjustment must preserve its role as the dominant text element.

## 5. Layout and cube separation

### 5.1 Composition contract

The heading remains a fixed viewport overlay and both elements remain horizontally centered.
Vertically, however, they are laid out as one stack rather than from unrelated anchors. The
stable composition is defined by:

1. the heading's rendered line box in its final, untransformed state;
2. a nominal gap of `clamp(2rem, 5vmin, 4rem)`; and
3. the cube's projected bounds at scale `1`, `SETTLE.yaw`, `SETTLE.pitch`, and zero float
   offset.

The midpoint between the heading's rendered top edge and the cube's rendered bottom edge
must land within 2 CSS pixels of the viewport's vertical midpoint. The heading's lower edge
must be the nominal gap above the cube's projected upper edge in that neutral state. This
replaces the former `top: clamp(1rem, 5vh, 5rem)` anchor.

The implementation must derive a responsive cube landing Y-position from the shared
composition metrics. It must not approximate the result with unrelated per-breakpoint
heading and cube offsets. `ENTRANCE.endY` is therefore no longer a fixed world-space zero;
the live scene framing provides the landing Y used by the entrance, resting state, and both
dock-transition directions.

The heading itself remains stationary after its reveal. Composition centering uses the
neutral float position and the settled rotation only; the heading must not follow the cube's
bob, drag, coast, hover, or live yaw. At the fixed `SETTLE.pitch`, the settled 45-degree yaw
is the tallest projected resting silhouette in the reference matrix, so dragging away from
it may increase the visible gap but must not decrease it.

### 5.2 Cube size

Set `FIT_MARGIN` to `1.9`, up from `1.6`. Do not change `CUBE_SIZE` or introduce a second
resting-scale control: camera framing remains the single source of truth for the landing
cube's apparent size. At the settled pose this produces a silhouette about 43–44% of the
smaller viewport dimension across the reference matrix, down from about 52–53%.

The dock remains independently sized in CSS pixels. `DOCK.silhouettePx` stays `64`, including
its existing small-viewport cap, so making the landing cube smaller does not make the docked
navigation control smaller.

### 5.3 Clearance and responsiveness

The stable heading position must leave at least 16 CSS pixels between its rendered lower
edge and the cube's rendered upper edge at every reference viewport in section 13. This
clearance must hold through:

- the full configured idle-float amplitude;
- every horizontal yaw the viewer can produce at the fixed `SETTLE.pitch`;
- the armed-face material change; and
- viewport resize after the reveal.

The composition is recalculated when the viewport changes, using the canvas's CSS-pixel size
and the heading's final line box. A resize may move both stable anchors to restore centering,
but interaction and animation frames must not continually relayout the heading. The default
hidden presentation must remain measurable after renderer setup without causing a visible
pre-reveal flash.

The heading must remain on-screen without horizontal clipping at 280 CSS pixels wide and
the entire composition must remain inside the viewport on the 844 × 390 short-landscape
reference viewport.

### 5.4 Induced motion constraints

Raising `FIT_MARGIN` also raises the off-screen entrance start. The existing
`ENTRANCE.startSpin` of `4.5` rev/s remains valid: the previously measured `FIT_MARGIN = 1.9`
worst case is 42.7 degrees per frame at 30 fps on a 9:19.5 viewport, below the 45-degree
strobing ceiling. Re-record that measurement in `AGENTS.md`; do not change the spin speed or
the exact 3.150-revolution landing.

The larger entrance start and lower responsive landing target increase the entrance tail
during the float overlap. With `FLOAT.overlap = 0.7`, the worst tested 280 × 1000 composition
reaches 0.09356 world units relative to the landing target, exceeding the 0.08-unit bound.
Set `FLOAT.overlap` to `0.65` seconds. The same matrix then peaks at 0.07758 units, preserving
the bound while moving the float onset only 50 ms later. The smooth-step envelope,
`rampDuration`, amplitude, period, C² onset, and pre-entrance-completion overlap remain
unchanged.

Dock travel must interpolate from the responsive landing Y to the existing responsive
`dockY`, and expansion must retrace that path back to the same landing Y. Position still uses
`easeInOutCubic`; scale, yaw spin, duration, reduced-motion behavior, and dock endpoint size
remain unchanged.

## 6. Reveal animation

### 6.1 Standard motion

On a fresh landing-page load, the heading is visually hidden while the cube is in the
`entering` phase. The transition from `entering` to `resting` triggers exactly one reveal:

| Property | Start | End |
| --- | --- | --- |
| Opacity | `0` | `1` |
| Vertical transform | `translateY(24px)` | `translateY(0)` |
| Clip | Fully clipped from the bottom | Fully revealed |
| Duration | `750ms` | — |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` | — |
| Delay | `0ms` after `entranceDone` | — |

The fade, rise, and bottom-to-top clipping are one synchronized animation. The final visual
state is persistent: opacity 1, no transform, and no clip. No animation timer is added to the
Three.js frame loop.

### 6.2 Leaving the landing page

When navigation away from the landing page begins, the heading becomes non-semantic
immediately and fades from opacity 1 to 0 over `200ms`. It does not translate during exit.
The exit overlaps the cube's existing shrink-to-dock transition and must not delay routing or
content mounting. Once the fade ends, the heading is fully hidden.

### 6.3 Returning to the landing page

The reveal is an initial-entrance event, not a general `resting`-phase animation.

- When a content route returns to the landing route, keep the heading hidden during any
  cube expansion. Show it at the moment the restored landing view reaches `resting`.
- Show it immediately in its final state: no fade, translation, clipping, or replay.
- If history returns to the landing route while the large cube is already resting at its
  composition anchor, show the final state immediately with no transition.
- Reloading the landing document creates a new session, plays the entrance, and therefore
  plays the reveal again.

### 6.4 Reduced motion

Under `prefers-reduced-motion: reduce`, preserve the requested reveal but remove its spatial
movement. Use a `150ms` opacity-only fade with no translation and no animated clipping. The
heading remains persistent after that fade. The existing recorded policy for the cube's
3.5-second entrance remains unchanged.

## 7. Visibility lifecycle

The welcome presentation must distinguish the actual landing route from the nav overlay.
`resting` alone is insufficient because the application also uses `resting` for the large
cube opened above a content page.

| Application situation | Welcome mode |
| --- | --- |
| Fresh `#/` or empty-hash boot, cube entering | `waiting` |
| Initial landing `entering -> resting` | `revealing` |
| Initial reveal completed | `visible` |
| Landing page after later return | `visible`, without animation |
| Shrinking from landing to a content route | `exiting`, then `hidden` |
| Direct content deep link | `hidden` |
| Docked content page | `hidden` |
| Large cube opened as nav over content | `hidden` |
| Transition between content routes | `hidden` |
| WebGL initialization failure | `hidden` |

The existing navigation reducer remains the source of truth for `phase` and `route`. Welcome
presentation is derived from those values plus one session-local `initialRevealPending` flag.
It starts `true` only when the document boots on the landing route, and is cleared when that
initial entrance completes or ceases to be the live route. A document that boots on a content
deep link therefore has no pending initial reveal: its first later visit to the landing page
uses the immediate final state. Do not add a welcome phase to `src/navstate.js` or duplicate
route state.

Keep this derivation in a small pure `src/welcome.js` module so every row of the table above
can be unit-tested without a browser. DOM class, attribute, and animation application remains
browser orchestration in `src/main.js`.

## 8. DOM, layering, and interaction

Add one persistent landing heading to `index.html`, separate from `#page`. Keeping it outside
`#page` prevents `mountContent()` and content fades from recreating it.

The element:

- is an `<h1>` containing `Welcome`;
- is visually above the cube in page space;
- may sit above the canvas in stacking order, but uses `pointer-events: none`;
- never receives pointer capture, focus, or a hit target;
- never changes the canvas bounds or the raycaster's coordinate conversion; and
- remains below the visually revealed keyboard skip links in stacking order.

No wrapper is required unless it makes the mask implementation clearer. Any wrapper is
presentational only and must also use `pointer-events: none`.

## 9. Accessibility semantics

- On the landing route, `Welcome` is the page's semantic `<h1>` even while its visual reveal
  is waiting. Delaying the decorative visual presentation must not withhold the page identity
  from assistive technology.
- On content routes and while content is the active page behind the navigation overlay, the
  welcome heading is removed from the accessibility tree. Each content route's existing
  heading remains its relevant `<h1>`.
- At the start of a departure, remove `Welcome` from the accessibility tree immediately even
  though its 200ms visual fade is still completing.
- Returning to the landing route restores the heading's semantics when the landing view is
  restored.
- Do not add `aria-live`; the visual flourish is not an announcement requiring interruption.
- The heading's presence must not alter the hidden navigation's document-first tab order,
  focus behavior, or visible focus treatment.

## 10. Geist integration

Use the official Geist Sans variable webfont. The official project describes Geist Sans as a
modern geometric face designed for legibility and simplicity, and distributes it under the
SIL Open Font License 1.1:

- Project: <https://github.com/vercel/geist-font>
- Typeface page: <https://vercel.com/font>

Self-host one variable WOFF2 asset and preserve its license text in the repository. Suggested
locations are:

- `public/fonts/Geist-Variable.woff2`
- `public/fonts/OFL.txt`

Declare the font with `@font-face`, the available variable weight range, normal style, WOFF2
format, and `font-display: swap`. The production page must request the font from the built
site's own origin.

Apply Geist to the existing global `html, body` font declaration so it reaches content,
hidden navigation links when focused, and controls through inheritance. Preserve the current
weight hierarchy:

- ordinary copy: `400`;
- existing content headings: `500`;
- welcome heading: `450`.

The existing system font list remains after `Geist` as a loading and failure fallback. Do not
introduce a JavaScript font loader or make UI visibility depend on `document.fonts.ready`.
Font swapping must not replay the welcome animation.

## 11. Failure and edge behavior

- The default CSS/markup state is visually hidden. JavaScript promotes the heading only after
  successful renderer setup, preserving the existing blank off-white WebGL-failure fallback.
- A missing font asset falls back to the existing system stack; it must not hide or delay the
  heading.
- An unknown hash continues to be replaced with the landing hash and then follows the normal
  fresh-landing entrance and reveal.
- A hash change during the cube entrance remains governed by the existing reconciliation
  logic. The heading must not flash during the ignored intermediate route event.
- Rapid history changes or resize events must not replay the reveal or leave the heading
  visible above a content route.
- A resize during the entrance or a dock transition must update the live composition target
  without producing a completion jump. The final phase must use the latest viewport's
  landing Y, not a stale value captured before the resize.
- The 200ms exit is visual only. Animation cancellation must still settle on the visibility
  required by the latest route and phase.

## 12. Expected implementation surface

| File | Responsibility |
| --- | --- |
| `index.html` | Add the persistent landing `<h1>`. |
| `public/fonts/Geist-Variable.woff2` | Locally hosted official variable font. |
| `public/fonts/OFL.txt` | Preserve the font's SIL Open Font License. |
| `src/config.js` | Set `FIT_MARGIN` to `1.9` and `FLOAT.overlap` to `0.65`, with their measured constraints. |
| `src/style.css` | Declare Geist, apply it globally, expose the responsive composition gap, and define standard, exit, and reduced-motion presentation. |
| `src/composition.js` | Purely derive centered stack placement from viewport, heading, gap, and projected-cube metrics; import neither the DOM nor Three.js. |
| `src/scene.js` | Recalculate camera framing and expose the projection data and responsive landing Y needed by the composition. |
| `src/dock.js` | Interpolate from a supplied responsive landing Y instead of hard-coded world-space zero. |
| `src/main.js` | Derive welcome modes, measure the hidden heading safely, apply composition layout, and refresh it on resize. |
| `src/welcome.js` | Derive welcome mode and initial-reveal state from navigation transitions; import neither the DOM nor Three.js. |
| `tests/welcome.test.js` | Cover the complete welcome lifecycle table and stale-transition cases. |
| `tests/composition.test.js` | Lock group centering, nominal gap, responsive landing offsets, and reference-viewport bounds. |
| `tests/scene.test.js` | Update camera/dock expectations and preserve the entrance-tail-plus-float bound at the new framing. |
| `AGENTS.md` | Record the visible heading, centered composition, framing, adjusted overlap, lifecycle, and Geist decisions. |
| `README.md` | Describe the welcome reveal, centered composition, font asset, and new source modules. |

No change is expected in `src/animation.js`, `src/navstate.js`, `src/input.js`, `src/pages.js`,
or the route table. `entranceState()` already accepts `endY`; only its live input changes.

## 13. Verification plan

### 13.1 Automated checks

- Preserve all existing navigation, cube, drag, picking, animation, and dock tests.
- In `tests/welcome.test.js`, test at minimum:
  - fresh landing boot waits;
  - only initial `entering -> resting` requests `revealing`;
  - initial content deep links stay hidden;
  - the first landing visit after a content deep link is immediately visible;
  - content-route `resting` nav overlays stay hidden;
  - leaving landing exits and settles hidden;
  - later landing returns select `visible`, never `revealing`; and
  - stale transition completion cannot make the heading visible on content.
- In `tests/composition.test.js`, test at minimum:
  - the combined neutral-state bounds center within 2 CSS pixels;
  - the nominal gap follows `clamp(2rem, 5vmin, 4rem)` at every reference viewport;
  - the landing offset is below the viewport midpoint and is recalculated on resize;
  - the heading does not move when yaw or float changes; and
  - the 16-pixel minimum clearance survives maximum upward float and the full yaw sweep.
- Update scene and dock tests to prove:
  - `FIT_MARGIN = 1.9` produces the intended landing silhouette;
  - the entrance tail plus overlapping float remains below 0.08 world units at
    `FLOAT.overlap = 0.65`;
  - shrink and expansion use the supplied landing Y at both endpoints; and
  - the dock still renders at its existing CSS-pixel size.
- `npm test` passes.
- `npm run build` succeeds and contains the Geist WOFF2 asset.
- The built CSS resolves the font from the same origin and contains no font-CDN URL.

Do not add jsdom solely to test CSS animation. Timing, clipping, actual font rendering, and
pixel separation are browser verification concerns.

### 13.2 Browser checks

Check the fresh entrance, stable state, full float cycle, horizontal drag/coast, departure,
return, refresh, deep link, nav overlay, back/forward, resize, and reduced-motion behavior at:

- 1920 x 1080;
- 1440 x 900;
- 1000 x 1000;
- 390 x 844;
- 280 x 1000; and
- 844 x 390 short landscape.

At each size, verify:

- the heading is large, centered, crisp, and rendered in Geist;
- the entire word remains on-screen and on one line;
- the neutral heading-plus-cube bounds are vertically centered within 2 CSS pixels;
- the neutral gap matches `clamp(2rem, 5vmin, 4rem)`;
- its stable lower edge remains at least 16 CSS pixels above the cube through maximum bob and
  a complete yaw sweep;
- the settled cube spans approximately 43–44% of the smaller viewport dimension while the
  dock retains its existing 64-pixel target or small-viewport cap;
- the heading does not move after the reveal;
- the reveal has no dead delay after the cube settles;
- pointer hover, drag, coast, tap, and navigation behave exactly as before; and
- content pages do not acquire unacceptable wrapping, overflow, or layout shifts under
  Geist.

Also simulate a failed WebGL renderer and a failed font request. The first must retain the
blank off-white fallback; the second must retain readable fallback text.

## 14. Spec-of-record amendments

Implementation must update `AGENTS.md` and `README.md` so they no longer claim that the
landing page has no visible DOM text or that the site uses the old system typography.

The revised product rule is:

- The landing page has one visible DOM heading, `Welcome`; no other visible navigation text,
  breadcrumbs, menu, subtitle, or body copy is added.
- The heading and the neutral settled cube are centered vertically as one responsive stack,
  with a `clamp(2rem, 5vmin, 4rem)` nominal gap. The heading stays fixed while the cube floats.
- Landing cube size is controlled by `FIT_MARGIN = 1.9`; `CUBE_SIZE` does not control its
  projected size, and the dock retains its CSS-pixel sizing.
- The heading reveals after the initial cube entrance, remains stationary and visible, and
  returns without replaying its reveal.
- Geist Sans is the site-wide primary typeface and is self-hosted.

## 15. Acceptance criteria

- [ ] A fresh landing-page load shows no heading during the cube entrance.
- [ ] At `entranceDone`, `Welcome` immediately begins the approved 750ms masked upward fade.
- [ ] The heading remains fully visible and motionless after revealing while the cube bobs.
- [ ] The heading is ordinary DOM text and no text object is added to Three.js.
- [ ] The final heading and neutral settled cube form one vertical stack whose combined
      bounds are centered within 2 CSS pixels of the viewport midpoint.
- [ ] The neutral heading-to-cube gap follows `clamp(2rem, 5vmin, 4rem)`.
- [ ] There is at least a 16px visual gap between heading and cube throughout the reference
      viewport, yaw, and float matrix.
- [ ] `FIT_MARGIN = 1.9` draws the settled cube at approximately 43–44% of the smaller
      viewport dimension without changing `CUBE_SIZE` or the dock's CSS-pixel size.
- [ ] The entrance, resting state, shrink, and expansion share the latest responsive landing
      Y and have no phase-boundary jump, including after resize.
- [ ] `FLOAT.overlap = 0.65` preserves the seamless pre-settle onset and keeps the measured
      entrance-tail-plus-float peak below 0.08 world units at every reference viewport.
- [ ] The heading never blocks cube hover, drag, tap, or face picking.
- [ ] Leaving the landing page fades the heading out without delaying navigation.
- [ ] Content pages and the large navigation overlay never show the welcome heading.
- [ ] Returning to the landing page shows the heading in its final state without animation.
- [ ] Refreshing the landing page replays the entrance and reveal.
- [ ] Reduced motion uses a short opacity-only reveal with no spatial movement.
- [ ] Geist Sans is served locally and applies across the entire site, with its license kept
      in the repository and the existing system stack retained as fallback.
- [ ] Content hierarchy and layout remain intact after the typography change.
- [ ] Assistive technology sees the landing heading but not an irrelevant duplicate on
      content routes, and no live-region announcement is introduced.
- [ ] WebGL failure retains the current blank off-white fallback.
- [ ] `AGENTS.md` and `README.md` reflect the new heading and typography decisions.
- [ ] `npm test` passes and `npm run build` succeeds.
