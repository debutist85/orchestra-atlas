# Styling guide

Follow the Tailwind and bespoke-component direction in
[architecture.md](architecture.md#styling). The [audit](styling-audit.md) records
migration history and known validation gaps.

## Ownership rules

- Use Tailwind for ordinary layout, responsive composition, sizing, spacing,
  typography, colors, borders, and simple hover/focus/disabled/pressed states.
  This is the default for new UI. Do not create a stylesheet for an ordinary
  control or replace utility strings with `@apply` merely to shorten JSX.
- Keep CSS for bespoke visual treatments, pseudo-elements, native slider parts,
  keyframes, and complex coordinated state rules. Keep reduced-motion behavior
  with the animation it modifies.
- Preserve class names that scene code, DOM queries, or animation timelines use.
  A class name can remain an interaction hook without owning any CSS.
- Keep measured spatial composition and cross-experience state coordination in
  feature CSS when utility variants would obscure their relationships. Ordinary
  defaults belong in JSX; spatial overrides belong to the layout owner.
- Runtime styles and custom properties are appropriate for projection, progress,
  artwork parameters, and animation. Distinguish `transform` from individual
  `translate`, `scale`, and `rotate`: these compose instead of replacing one
  another. Do not change the property written by a runtime system incidentally.
- Give each property one default owner. Remove its ordinary CSS declaration when
  moving it into utilities. Intentional coordinated state/animation overrides
  should remain explicit and documented.
- Shared components must earn their place through repeated markup and behavior.
  Keep domain state and navigation outside visual primitives. No component
  library or additional styling dependency is required.

## Foundations

`src/styles/global.css` imports Tailwind, tokens, and the retained feature CSS.
It owns font registration, document defaults, and the screen-reader-only helper.
Tailwind preflight supplies control font inheritance; do not restore an unlayered
`button { font: inherit }` reset, which overrides utility font sizes.

`src/styles/tokens.css` owns the palette, semantic aliases, and demonstrated
shared control values. Prefer these over repeated literals:

| Role | Tailwind utility |
|---|---|
| Page background | `bg-surface-page` |
| Primary text | `text-text-primary` |
| Control text | `text-text-control` |
| Secondary text | `text-text-secondary` |
| Muted text | `text-text-muted` |
| Navigation text | `text-navigation` |
| UI / identity font | `font-ui` / `font-identity` |
| Control label size | `text-control-label` (`0.7rem`) |
| Control tracking | `tracking-control` (`0.04em`) |
| Control horizontal inset | `px-control-inset` (`0.55rem`) |
| Focus color | `outline-focus` |
| Focus width | `outline-(length:--focus-ring-width)` (`2px`) |

Use existing spacing utilities when they match the intended values. Preserve
one-off art-directed sizes rather than rounding them into a new universal scale.
Family colors, camera configuration, and scene materials remain feature-owned.
Semantic aliases do not guarantee contrast on every scene background.

Focus rings show for keyboard use only. The app moves focus by script (onto Back when the explorer opens, onto the title when returning to the map), which browsers may otherwise ring after a click or tap; `src/lib/input-modality.ts` records the latest input on `<html>` and `global.css` drops the outline while it was a pointer. Keyboard input restores rings at once.

Existing feature CSS is unlayered and can override layered utilities. Do not
change layers or import order as incidental cleanup. For legacy inclusive media
queries, preserve the actual condition, for example
`[@media(max-width:480px)]:text-[9px]`. Do not silently consolidate breakpoints
or change an inclusive boundary into a strict `width < ...` condition.

## Current split

| Area | Tailwind owns | Retained CSS owns |
|---|---|---|
| Header back control | `HeaderBackButton.tsx`: layout, typography, responsive sizing, focus and disabled states | No dedicated stylesheet; callers retain navigation and animation refs |
| Playback and orchestra lock | `PlaybackControls.tsx`, `FullOrchestraLock.tsx`: composition, ordinary appearance, focus, state and responsive spacing | `playback-controls.css`: native range parts and invitation pulse; map CSS coordinates entrance and visibility |
| Credits | `ModelCredits.tsx`: placement, dialog layout, typography, mobile presentation, backdrop and focus | No dedicated stylesheet; native dialog behavior stays in the component |
| Shared loader | `Loader.tsx`: host geometry | `loader.css`: parameter defaults, ripple pseudo-elements and reduced motion |
| Explorer | `InstrumentExplore.tsx`, `SpatialTypography.tsx`, `InstrumentModel.tsx`: static layers, text, controls, spacing and focus | `instrument-explore.css`: initial poses, projected transforms, anchor glows, coordinated visibility and motion; imperative canvas sizing |
| Anatomy | JSX: static label/action geometry and typography | `anatomy-controls.css`: directional gradients, staggered reveals, luminous surfaces and progress-ring geometry |
| Demonstration | JSX: panel/media/loader layout | `demonstration.css`: shared slide parameters, transforms, video reveal and loading animation |
| Map | JSX: stage defaults, chrome, caption and label appearance, invitation geometry, text and focus | `orchestra-map.css`: viewport fallbacks, scene integration, caption projection/masks, coordinated transitions, accessible scene-error/focus presentation and glyph animation |
| Development tools | `DebugButton.tsx` and debug components: ordinary controls, forms and panels; preview uses utilities | `instrument-debug.css`: editing-marker outline |

`HeaderBackButton` is shared by the real header and the preview so their states
cannot drift. `DebugButton` shares the actual repeated editor-button treatment.
Neither owns navigation, audio, or editing state.

The lock and credits retain their previous effective appearance and minimum
heights. Their old minimum-height/pressed-color declarations were overridden
before this migration. Stronger pressed styling and target-size improvements
remain explicit visual/accessibility follow-ups, not incidental refactoring.

## Review

Run `npm run dev` and open `/?style-preview` for the development-only foundation
preview. It includes semantic colors and fonts, live lock/loaders and the shared
header back control, plus a clearly labeled local range specimen. The checkbox
exposes the back button's disabled state.
The instrument-preparation toggle previews the staged hint fade/cluster slide
without loading a model. The preview skips audio connection and
route synchronization and does not mount the scene. Its JavaScript is lazy-loaded
only in development and excluded from production; Tailwind scans its utility
strings at build time. It is not a substitute for reviewing the real scene.

For visual migrations, review desktop/mobile, both orientations, responsive
boundaries, keyboard focus, pressed/disabled/loading/error states, and reduced
motion. Check native range rendering in Chromium and Firefox when changing its
parts. Run build, lint, and relevant existing tests; record unavailable checks.

Current limitation: no browser is connected to this agent session, so visual
baseline comparison and interactive browser review remain pending. The full
suite also has an unrelated violin caption expectation failure; see the audit.
