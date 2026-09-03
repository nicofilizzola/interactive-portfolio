# Welcome Reveal and Geist Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a large landing-only `Welcome` heading that reveals after the initial cube entrance and adopt a locally hosted Geist Sans variable font across the site.

**Architecture:** Keep the heading as persistent HTML outside `#page` and keep Three.js, routing, and the navigation reducer unchanged. A pure `src/welcome.js` reducer derives presentation from navigation transitions plus one initial-reveal flag; `src/main.js` applies those modes to the DOM, while CSS owns layout and motion. Geist is a pinned local WOFF2 asset with its OFL license and no runtime font service.

**Tech Stack:** Vite 8, plain JavaScript, Vitest 4, HTML/CSS, Three.js 0.185.1, Geist Sans variable WOFF2.

**Spec:** `docs/specs/2026-09-02-welcome-reveal.md`

## Global Constraints

- Copy is exactly `Welcome`, with no punctuation, subtitle, body copy, or visible menu.
- The heading is DOM text, never Three.js geometry, a canvas texture, a sprite, or a raycast target.
- The initial reveal begins at `entranceDone`: `750ms`, `translateY(24px) -> translateY(0)`, opacity `0 -> 1`, bottom-to-top clipping, `cubic-bezier(0.22, 1, 0.36, 1)`, and no delay.
- The heading remains visible and stationary after revealing; it never follows the cube's bob, drag, coast, hover, yaw, or resize-time pose.
- Departure uses a `200ms` opacity-only fade and cannot delay routing or content mounting.
- Later returns to the landing page show the final state immediately after the landing view reaches `resting`; they never replay the reveal.
- Reduced motion uses a `150ms` opacity-only reveal with no translation or animated clipping. The cube entrance remains unchanged.
- Stable heading/cube separation is at least 16 CSS pixels across the required viewport, full-yaw, and maximum-float matrix.
- Welcome typography starts at Geist weight `450`, size `clamp(2.25rem, min(11vw, 11vh), 7rem)`, line-height `0.9`, letter-spacing `-0.045em`, and color `#2a2c30`.
- Geist applies site-wide: copy stays weight `400`, existing content headings stay `500`, and the current system stack remains fallback only.
- Self-host the official Geist v1.7.2 variable WOFF2 and OFL text. Add no npm dependency, font CDN, Google Fonts URL, or JavaScript font loader.
- Preserve the document-first hidden navigation, one relevant `<h1>` per route, content focus management, hash routing, deep links, blank WebGL-failure fallback, and all cube interactions.
- Do not change `src/scene.js`, `src/animation.js`, `src/navstate.js`, `src/input.js`, `src/pages.js`, `src/routes.js`, cube timing, or navigation timing.
- Preserve the user's uncommitted `docs/review.md` change; do not stage or commit it.
- Node remains `^20.19.0 || >=22.12.0`.

---

## File Structure

### Create

- `src/welcome.js` — pure welcome presentation reducer; imports route constants only and touches neither the DOM nor Three.js.
- `tests/welcome.test.js` — headless lifecycle coverage for every presentation mode and stale animation completion.
- `public/fonts/Geist-Variable.woff2` — pinned official Geist v1.7.2 variable webfont.
- `public/fonts/OFL.txt` — exact license bundled with Geist v1.7.2.

### Modify

- `index.html:8-30` — add one persistent, default-hidden landing `<h1>` after the document-first navigation and before `#page`.
- `src/style.css:1-15` — declare Geist and apply it globally.
- `src/style.css:49-132` — add welcome layout, visual modes, keyframes, and reduced-motion override without changing canvas hit testing.
- `src/main.js:14-29` — import the pure welcome lifecycle functions.
- `src/main.js:37-41` — capture the welcome heading element.
- `src/main.js:78-104` — initialize session-local welcome state from the parsed boot route.
- `src/main.js:157-170` — apply visual mode and accessibility semantics.
- `src/main.js:216-264` — reduce welcome state alongside navigation transitions.
- `src/main.js:360-369` — attach animation completion handling and reveal the element only after renderer setup.
- `AGENTS.md` — record the single visible landing heading and site-wide Geist decision.
- `README.md` — describe the reveal, typography, font assets, and welcome lifecycle module.

---

### Task 1: Build the pure welcome lifecycle

**Files:**

- Create: `src/welcome.js`
- Create: `tests/welcome.test.js`

**Interfaces:**

- Consumes: `LANDING_ROUTE` from `src/routes.js`; navigation snapshots shaped as `{ phase: string, route: string | null }`.
- Produces: `initialWelcomeState(route) -> { mode, initialRevealPending }`.
- Produces: `reduceWelcome(state, previousNav, nextNav) -> state`.
- Produces: `completeWelcomeAnimation(state, completedMode) -> state`.
- `mode` is exactly one of `waiting`, `revealing`, `visible`, `exiting`, or `hidden`.
- `completedMode` is `revealing` or `exiting`; mismatched stale completions return the same state object.

- [ ] **Step 1: Write the failing lifecycle tests**

Create `tests/welcome.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  completeWelcomeAnimation,
  initialWelcomeState,
  reduceWelcome,
} from '../src/welcome.js';

function nav(phase, route = null) {
  return { phase, route };
}

describe('initialWelcomeState', () => {
  it('waits only when the document boots on the landing route', () => {
    expect(initialWelcomeState(null)).toEqual({
      mode: 'waiting',
      initialRevealPending: true,
    });
  });

  it('starts hidden with no pending reveal on a content deep link', () => {
    expect(initialWelcomeState('work')).toEqual({
      mode: 'hidden',
      initialRevealPending: false,
    });
  });
});

describe('reduceWelcome', () => {
  it('reveals exactly when the initial landing entrance completes', () => {
    const state = initialWelcomeState(null);
    const next = reduceWelcome(state, nav('entering'), nav('resting'));

    expect(next).toEqual({ mode: 'revealing', initialRevealPending: false });
  });

  it('keeps every content state hidden, including the resting nav overlay', () => {
    const state = initialWelcomeState('work');

    expect(reduceWelcome(state, nav('docked', 'work'), nav('expanding', 'work'))).toEqual(
      state,
    );
    expect(reduceWelcome(state, nav('expanding', 'work'), nav('resting', 'work'))).toEqual(
      state,
    );
  });

  it('exits when a visible landing begins shrinking to content', () => {
    const state = { mode: 'visible', initialRevealPending: false };

    expect(reduceWelcome(state, nav('resting'), nav('shrinking', 'work'))).toEqual({
      mode: 'exiting',
      initialRevealPending: false,
    });
  });

  it('settles only the animation that matches the current mode', () => {
    expect(
      completeWelcomeAnimation(
        { mode: 'revealing', initialRevealPending: false },
        'revealing',
      ),
    ).toEqual({ mode: 'visible', initialRevealPending: false });
    expect(
      completeWelcomeAnimation({ mode: 'exiting', initialRevealPending: false }, 'exiting'),
    ).toEqual({ mode: 'hidden', initialRevealPending: false });
  });

  it('ignores a stale animation completion after the mode changed', () => {
    const state = { mode: 'visible', initialRevealPending: false };

    expect(completeWelcomeAnimation(state, 'exiting')).toBe(state);
    expect(completeWelcomeAnimation(state, 'revealing')).toBe(state);
  });

  it('stays hidden during a return expansion, then appears without revealing', () => {
    const state = initialWelcomeState('work');
    const expanding = reduceWelcome(state, nav('docked', 'work'), nav('expanding'));
    const resting = reduceWelcome(expanding, nav('expanding'), nav('resting'));

    expect(expanding).toEqual({ mode: 'hidden', initialRevealPending: false });
    expect(resting).toEqual({ mode: 'visible', initialRevealPending: false });
  });

  it('appears immediately when history restores landing at an already-resting cube', () => {
    const state = initialWelcomeState('work');
    const next = reduceWelcome(state, nav('resting', 'work'), nav('resting'));

    expect(next).toEqual({ mode: 'visible', initialRevealPending: false });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```powershell
npm test -- tests/welcome.test.js
```

Expected: FAIL during module import because `src/welcome.js` does not exist.

- [ ] **Step 3: Implement the minimal pure reducer**

Create `src/welcome.js`:

```js
import { LANDING_ROUTE } from './routes.js';

export function initialWelcomeState(route) {
  const initialRevealPending = route === LANDING_ROUTE;
  return {
    mode: initialRevealPending ? 'waiting' : 'hidden',
    initialRevealPending,
  };
}

export function reduceWelcome(state, previousNav, nextNav) {
  if (nextNav.route !== LANDING_ROUTE) {
    const leavingVisibleLanding =
      previousNav.route === LANDING_ROUTE &&
      (state.mode === 'revealing' || state.mode === 'visible');

    return {
      mode: leavingVisibleLanding ? 'exiting' : 'hidden',
      initialRevealPending: false,
    };
  }

  if (nextNav.phase === 'entering') {
    return { mode: 'waiting', initialRevealPending: state.initialRevealPending };
  }

  if (nextNav.phase !== 'resting') {
    return { mode: 'hidden', initialRevealPending: state.initialRevealPending };
  }

  if (state.initialRevealPending && previousNav.phase === 'entering') {
    return { mode: 'revealing', initialRevealPending: false };
  }

  return { mode: 'visible', initialRevealPending: false };
}

export function completeWelcomeAnimation(state, completedMode) {
  if (state.mode !== completedMode) return state;
  if (completedMode === 'revealing') {
    return { ...state, mode: 'visible' };
  }
  if (completedMode === 'exiting') {
    return { ...state, mode: 'hidden' };
  }
  return state;
}
```

The reducer deliberately does not know animation durations, DOM attributes, Three.js time,
or the URL. `nextNav.route` remains authoritative, and `initialRevealPending` is consumed once.

- [ ] **Step 4: Run focused and full tests**

Run:

```powershell
npm test -- tests/welcome.test.js
npm test
```

Expected: the focused file reports 9 passing tests. The full suite reports 15 passing files
and 230 passing tests: the existing 14 files/221 tests plus the new lifecycle coverage.

- [ ] **Step 5: Commit the pure lifecycle**

```powershell
git add -- src/welcome.js tests/welcome.test.js
git commit -m "feat: add welcome lifecycle"
```

---

### Task 2: Self-host Geist and apply it globally

**Files:**

- Create: `public/fonts/Geist-Variable.woff2`
- Create: `public/fonts/OFL.txt`
- Modify: `src/style.css:1-15`

**Interfaces:**

- Consumes: official Geist v1.7.2 release archive at `https://github.com/vercel/geist-font/releases/download/v1.7.2/geist-font-v1.7.2.zip`.
- Produces: CSS family name `Geist`, covering normal variable weights `100 900`.
- Produces: same-origin public asset URL `/fonts/Geist-Variable.woff2`.
- Invariant: `package.json` and `package-lock.json` do not change.

- [ ] **Step 1: Download the pinned official release into a unique temporary directory**

Run from the repository root in PowerShell:

```powershell
$geistTemp = Join-Path ([System.IO.Path]::GetTempPath()) ('geist-v1.7.2-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $geistTemp | Out-Null
$geistZip = Join-Path $geistTemp 'geist-font-v1.7.2.zip'
Invoke-WebRequest -Uri 'https://github.com/vercel/geist-font/releases/download/v1.7.2/geist-font-v1.7.2.zip' -OutFile $geistZip
Expand-Archive -LiteralPath $geistZip -DestinationPath (Join-Path $geistTemp 'release')
```

Expected: the archive expands beneath `$geistTemp/release/geist-font`.

- [ ] **Step 2: Verify the official assets before copying them**

Run:

```powershell
$geistRoot = Join-Path $geistTemp 'release/geist-font'
$geistFont = Join-Path $geistRoot 'Geist/webfonts/Geist[wght].woff2'
$geistLicense = Join-Path $geistRoot 'OFL.txt'
Get-FileHash -Algorithm SHA256 -LiteralPath $geistFont, $geistLicense
```

Expected SHA-256 values:

```text
Geist[wght].woff2  A369FCF5628EA2AA4E1B9E2EC6A5B3624E365BDA588E1F0F2F12B564F728FBB8
OFL.txt            C683BFBCC7E087F5D37A54EF628F10387C451A83DDC459B151403A164AC46C90
```

Stop this task if either checksum differs; do not copy an unverified binary into the repo.

- [ ] **Step 3: Copy the font and license into the public asset tree**

Run:

```powershell
New-Item -ItemType Directory -Path 'public/fonts' -Force | Out-Null
Copy-Item -LiteralPath $geistFont -Destination 'public/fonts/Geist-Variable.woff2'
Copy-Item -LiteralPath $geistLicense -Destination 'public/fonts/OFL.txt'
Get-FileHash -Algorithm SHA256 -LiteralPath 'public/fonts/Geist-Variable.woff2', 'public/fonts/OFL.txt'
```

Expected: the copied files retain the two hashes from Step 2.

- [ ] **Step 4: Declare Geist and replace the global primary family**

Insert this block at the top of `src/style.css`, before the universal reset:

```css
@font-face {
  font-family: 'Geist';
  src: url('/fonts/Geist-Variable.woff2') format('woff2');
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
}
```

Replace the current `font` declaration in `html, body` with:

```css
  font: 400 1rem/1.7 'Geist', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

Do not change the existing `#page h1` weight `500`; the focused hidden navigation links and
dock button inherit Geist automatically.

- [ ] **Step 5: Verify the production asset and same-origin CSS URL**

Run:

```powershell
npm run build
Test-Path 'dist/fonts/Geist-Variable.woff2'
Test-Path 'dist/fonts/OFL.txt'
rg -n "Geist-Variable\.woff2|fonts\.googleapis|fonts\.gstatic" dist/assets -g '*.css'
git diff -- package.json package-lock.json
```

Expected:

- Vite build succeeds.
- Both `Test-Path` calls print `True`.
- Built CSS contains `/fonts/Geist-Variable.woff2` and no Google Fonts domains.
- `git diff` prints nothing for both package files.

- [ ] **Step 6: Commit the font assets and global typography**

```powershell
git add -- public/fonts/Geist-Variable.woff2 public/fonts/OFL.txt src/style.css
git commit -m "feat: self-host Geist typography"
```

---

### Task 3: Render and animate the landing heading

**Files:**

- Modify: `index.html:8-30`
- Modify: `src/style.css:49-132`
- Modify: `src/main.js:14-29,37-41,78-104,157-170,216-264,360-369`

**Interfaces:**

- Consumes: `initialWelcomeState`, `reduceWelcome`, and `completeWelcomeAnimation` from Task 1.
- Consumes: global `Geist` family from Task 2.
- Produces: persistent element `#welcome` with `data-mode` equal to the pure state mode.
- Produces: `aria-hidden="false"` only while landing is semantically active in `entering` or `resting`; content and landing expansion use `aria-hidden="true"`.
- Produces: animation names `welcome-reveal`, `welcome-reveal-reduced`, and `welcome-exit`, which the completion handler maps back to `revealing` or `exiting`.

- [ ] **Step 1: Add the persistent, fail-closed heading markup**

In `index.html`, insert this after `</nav>` and before `<main id="page">`:

```html
    <!-- Landing-only DOM heading. It starts hidden so a failed WebGL renderer
         preserves the intended blank off-white fallback; main.js reveals it only
         after renderer setup. Pointer input continues to belong to the canvas. -->
    <h1 id="welcome" hidden>Welcome</h1>
```

Keep the hidden navigation first in the document. Do not place the heading inside `#page`,
because `mountContent()` replaces that element's `innerHTML` on route changes.

- [ ] **Step 2: Add the stable heading layout and visual modes**

Insert the following in `src/style.css` after the `#routes a:focus-visible` block and before
`#page`:

```css
#welcome {
  position: fixed;
  top: clamp(1rem, 5vh, 5rem);
  left: 50%;
  z-index: 3;
  max-width: calc(100vw - 2rem);
  overflow: hidden;
  color: #2a2c30;
  font-size: clamp(2.25rem, min(11vw, 11vh), 7rem);
  font-weight: 450;
  line-height: 0.9;
  letter-spacing: -0.045em;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
  transform: translate(-50%, 24px);
  clip-path: inset(100% 0 0);
}

#welcome[data-mode='waiting'] {
  visibility: visible;
}

#welcome[data-mode='revealing'] {
  visibility: visible;
  animation: welcome-reveal 750ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

#welcome[data-mode='visible'] {
  visibility: visible;
  opacity: 1;
  transform: translate(-50%, 0);
  clip-path: inset(0);
}

#welcome[data-mode='exiting'] {
  visibility: visible;
  animation: welcome-exit 200ms ease-out both;
}

@keyframes welcome-reveal {
  from {
    visibility: visible;
    opacity: 0;
    transform: translate(-50%, 24px);
    clip-path: inset(100% 0 0);
  }

  to {
    visibility: visible;
    opacity: 1;
    transform: translate(-50%, 0);
    clip-path: inset(0);
  }
}

@keyframes welcome-exit {
  from {
    visibility: visible;
    opacity: 1;
    transform: translate(-50%, 0);
    clip-path: inset(0);
  }

  to {
    visibility: visible;
    opacity: 0;
    transform: translate(-50%, 0);
    clip-path: inset(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  #welcome[data-mode='revealing'] {
    transform: translate(-50%, 0);
    clip-path: inset(0);
    animation: welcome-reveal-reduced 150ms ease-out both;
  }
}

@keyframes welcome-reveal-reduced {
  from {
    visibility: visible;
    opacity: 0;
  }

  to {
    visibility: visible;
    opacity: 1;
  }
}
```

The `z-index` remains below focused hidden-nav links (`z-index: 4`) and above the canvas
(`z-index: 2`). `pointer-events: none` prevents any change to hover, drag, or raycasting.

- [ ] **Step 3: Import the lifecycle functions and capture the element**

Add this import in `src/main.js` with the other local modules:

```js
import {
  completeWelcomeAnimation,
  initialWelcomeState,
  reduceWelcome,
} from './welcome.js';
```

Add this DOM lookup after `dockButton`:

```js
const welcomeHeading = document.getElementById('welcome');
```

Immediately after `let nav = initialState(boot.route, elapsed);`, initialize the independent
presentation state:

```js
let welcomeState = initialWelcomeState(boot.route);
```

- [ ] **Step 4: Apply visual and semantic state from `applyDom()`**

Add this function immediately before `applyDom()`:

```js
function applyWelcomeDom() {
  welcomeHeading.dataset.mode = welcomeState.mode;
  const isLandingHeading =
    nav.route === null && (nav.phase === 'entering' || nav.phase === 'resting');
  welcomeHeading.setAttribute('aria-hidden', String(!isLandingHeading));
}
```

Call it as the first line inside `applyDom()`:

```js
function applyDom() {
  applyWelcomeDom();
```

The initial landing heading is therefore accessible while visually waiting. During content,
the content-nav overlay, and landing expansion it is removed from the accessibility tree.

- [ ] **Step 5: Reduce welcome state with every accepted nav transition**

At the top of `onNavChange(previous, next)`, before calculating `startedTransition`, add:

```js
  welcomeState = reduceWelcome(welcomeState, previous, next);
```

Do not call this from ignored navigation events: `dispatch()` already returns before
`onNavChange()` when `nav === previous`. This preserves the initial pending reveal until a
real transition occurs.

- [ ] **Step 6: Settle CSS animations without accepting stale completions**

Add this function before the `if (renderer)` boot block:

```js
function handleWelcomeAnimationEnd(event) {
  if (event.target !== welcomeHeading) return;

  let completedMode = null;
  if (event.animationName === 'welcome-exit') completedMode = 'exiting';
  if (
    event.animationName === 'welcome-reveal' ||
    event.animationName === 'welcome-reveal-reduced'
  ) {
    completedMode = 'revealing';
  }
  if (completedMode === null) return;

  const next = completeWelcomeAnimation(welcomeState, completedMode);
  if (next === welcomeState) return;
  welcomeState = next;
  applyWelcomeDom();
}
```

Inside the successful renderer block, reveal the fail-closed element and attach the listener
before `mountContent(nav.route)`:

```js
  welcomeHeading.hidden = false;
  welcomeHeading.addEventListener('animationend', handleWelcomeAnimationEnd);

  mountContent(nav.route);
```

Do not move either line outside `if (renderer)`: a renderer failure must leave the static
heading hidden.

- [ ] **Step 7: Run automated regression checks**

Run:

```powershell
npm test -- tests/welcome.test.js
npm test
npm run build
git diff --check
```

Expected:

- 9 welcome lifecycle tests pass.
- Full suite reports 15 passing test files and 230 passing tests.
- Vite production build succeeds.
- `git diff --check` reports no whitespace errors.

- [ ] **Step 8: Verify the browser lifecycle and semantics**

Start the app:

```powershell
npm run dev
```

Use the local browser and verify this sequence:

1. Load `#/`. Before 3.5 seconds, the element exists with `data-mode="waiting"`, opacity 0,
   and `aria-hidden="false"`.
2. At 3.5 seconds, it changes to `revealing` with no delay. After 750ms it becomes `visible`
   and stays motionless through at least one full 5-second cube bob.
3. Drag and coast the cube through a full yaw. The heading does not move, highlight behavior
   is unchanged, and pointer events still target the canvas.
4. Tap a routed face. The heading immediately gets `aria-hidden="true"`, plays only the
   200ms opacity exit, and does not delay the 0.9-second docking/content transition.
5. Press the docked cube to open the large navigation overlay. `Welcome` remains hidden even
   though the nav phase is `resting`.
6. Return to `#/` with history navigation. It stays hidden through `expanding`, then becomes
   `visible` without a reveal when `resting` begins.
7. Reload `#/`; the initial reveal plays again.
8. Load `#/work` directly, then navigate to `#/`; the first landing visit is immediate after
   expansion, with no initial reveal.
9. Change the hash away from landing before the entrance completes. Reconciliation must not
   paint a one-frame welcome flash over the content route.
10. In the accessibility tree, confirm `Welcome` is the landing `<h1>`, has no live-region
    role, and is excluded whenever a content `<h1>` is relevant. The hidden navigation stays
    first in focus order.

Enable `prefers-reduced-motion: reduce`, reload `#/`, and verify the cube entrance is still
3.5 seconds while the welcome uses a 150ms opacity-only reveal with no translation or clip
animation.

- [ ] **Step 9: Verify responsive separation and local font loading**

At each viewport below, let the float reach its upper peak and sweep the cube through 360
degrees of horizontal yaw:

```text
1920 x 1080
1440 x 900
1000 x 1000
390 x 844
280 x 1000
844 x 390
```

For every viewport, inspect screenshots and computed styles. Confirm:

- `Welcome` remains one line, centered, fully on-screen, and visually large.
- Its rendered lower edge stays at least 16 CSS pixels above the cube's uppermost rendered
  pixel throughout the yaw/float sweep.
- Computed `font-family` begins with `Geist`; body copy is weight 400, content headings 500,
  and welcome 450.
- The font request is same-origin `/fonts/Geist-Variable.woff2` and no font-CDN request occurs.
- Content pages retain readable wrapping, no horizontal overflow, and their current spacing
  hierarchy.

Use browser request blocking to block `/fonts/Geist-Variable.woff2`, reload, and confirm the
system fallback stays readable without delaying or replaying the welcome. Launch a browser
with WebGL disabled, reload `#/`, and confirm the page remains blank off-white with the
heading's `hidden` attribute intact.

- [ ] **Step 10: Commit the DOM and animation integration**

```powershell
git add -- index.html src/style.css src/main.js
git commit -m "feat: reveal landing welcome"
```

---

### Task 4: Update the spec of record and finish verification

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: shipped behavior and verified values from Tasks 1-3.
- Produces: durable project documentation that allows one visible landing heading, records
  its lifecycle, and names self-hosted Geist as the site-wide typeface.

- [ ] **Step 1: Add the landing heading requirement to `AGENTS.md`**

Append this as landing-page requirement 8 after the docked-navigation requirement:

```markdown
8. After the initial entrance finishes, one large DOM heading, `Welcome`, reveals above the
   cube with a 750 ms masked upward fade, then remains visible and motionless. It is not a 3D
   object and never tracks the cube's float. It fades out when navigation begins, stays hidden
   over content and the nav overlay, and returns without replaying its reveal.
```

- [ ] **Step 2: Amend the page and typography decisions in `AGENTS.md`**

Replace the sentence beginning `No *visible* DOM text on the landing page` in the Page
decision with:

```markdown
  The landing page has exactly one visible DOM heading, `Welcome`, above the cube. No other
  visible landing copy, nav text, breadcrumbs, or menu is present. The document still carries
  a `<nav>` of five links, visually hidden with `clip-path` but focusable and placed first so
  it doubles as skip navigation.
```

Add this decision immediately after the Page decision:

```markdown
- **Typography:** Geist Sans is the site-wide primary typeface, self-hosted as the official
  variable WOFF2 under the SIL Open Font License. Body copy remains weight 400, content
  headings remain 500, and the landing `Welcome` uses 450. The existing system stack is a
  loading/error fallback only; the site makes no font-CDN request.
```

In Out of Scope, replace `Visible nav text, breadcrumbs, or a menu` with `Additional visible
landing copy, visible nav text, breadcrumbs, or a menu` so the welcome heading is not
accidentally outlawed.

- [ ] **Step 3: Update `README.md` behavior and project layout**

Add this sentence after the README's first paragraph:

```markdown
When the initial entrance lands, a large Geist `Welcome` heading reveals above the cube and
then stays motionless while the cube continues to float. Later returns show it immediately
without replaying the reveal.
```

Add these entries to the Layout list:

```markdown
- `src/welcome.js` — pure presentation lifecycle for the landing heading; it distinguishes
  the true landing route from the large cube used as a content-page nav overlay.
- `public/fonts/` — the locally hosted Geist Sans variable WOFF2 and its SIL Open Font
  License.
```

Add this paragraph at the start of Design direction, after its heading:

```markdown
Geist Sans is the site-wide primary typeface, served locally with no font-CDN dependency. The
landing page has one visible DOM heading, `Welcome`; the hidden route navigation remains an
accessibility affordance rather than a visible menu.
```

- [ ] **Step 4: Scan the spec of record for contradictions**

Run:

```powershell
rg -n "no \*visible\* DOM text|No visible DOM text|system-ui.*primary|Visible nav text" AGENTS.md README.md docs/specs/2026-09-02-welcome-reveal.md
```

Expected: no stale prohibition or obsolete typography claim. The system stack may still
appear when explicitly described as a fallback.

- [ ] **Step 5: Run final automated verification**

Run:

```powershell
npm test
npm run build
Test-Path 'dist/fonts/Geist-Variable.woff2'
Test-Path 'dist/fonts/OFL.txt'
git diff --check
git status --short
```

Expected:

- 15 test files and 230 tests pass.
- Vite production build succeeds.
- Both public font artifacts are present in `dist/fonts`.
- `git diff --check` prints no errors.
- Status contains only intended task files plus the pre-existing `docs/review.md` change;
  `docs/review.md` remains unstaged.

- [ ] **Step 6: Re-run the final browser acceptance path against the production build**

Run:

```powershell
npm run preview
```

Repeat the Task 3 lifecycle once on desktop normal motion, once at 390 x 844, and once with
reduced motion. Confirm the production build—not only the dev server—loads Geist locally,
keeps the heading above the cube, hides it from content/nav-overlay states, and does not
replay it on landing return.

- [ ] **Step 7: Commit the documentation**

```powershell
git add -- AGENTS.md README.md
git commit -m "docs: record welcome typography"
```

---

## Final Acceptance Matrix

- [ ] A fresh landing load keeps `Welcome` visually hidden through the full 3.5-second cube
  entrance while exposing it as the landing page's semantic `<h1>`.
- [ ] `entranceDone` starts the 750ms masked upward opacity reveal with no delay.
- [ ] The heading settles completely still and remains visible while the cube floats, drags,
  coasts, and highlights faces independently.
- [ ] The stable heading has at least 16 CSS pixels of separation from the cube at all six
  reference viewports, maximum float, and every horizontal yaw.
- [ ] The heading never blocks or changes canvas hover, press, drag, tap, or raycasting.
- [ ] Departure immediately removes the heading from the accessibility tree and fades only
  its opacity for 200ms without delaying navigation.
- [ ] Direct content loads, docked pages, content-route transitions, and the large cube nav
  overlay keep `Welcome` hidden.
- [ ] Landing returns stay hidden through expansion and then show the final heading state
  instantly, including the first landing visit after a content deep link.
- [ ] Reloading landing replays the initial reveal; route/history changes do not cause flashes
  or stale animation completions.
- [ ] Reduced motion keeps the cube entrance policy unchanged and replaces the welcome motion
  with a 150ms opacity-only fade.
- [ ] Geist Sans v1.7.2 is served from the site's own `/fonts` path, applies site-wide at the
  specified weights, retains its OFL text, and falls back safely when blocked.
- [ ] No package dependency, font CDN, JavaScript font loader, 3D text, or extra landing copy
  is introduced.
- [ ] The hidden nav remains first and focusable; content routes retain one relevant `<h1>`
  and existing focus management.
- [ ] A WebGL initialization failure retains the blank off-white page and hidden welcome.
- [ ] `AGENTS.md` and `README.md` describe the delivered behavior without contradicting the
  approved spec.
- [ ] `npm test`, `npm run build`, production preview checks, and `git diff --check` succeed.
