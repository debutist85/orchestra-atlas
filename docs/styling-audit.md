# Styling audit and incremental plan

Status: audit history and migration record, 19 October 2026. The inventory below
describes the starting point; [styling.md](styling.md) describes current ownership.

Foundation follow-up: palette tokens now live in `src/styles/tokens.css`, with
semantic aliases for page background, text roles, and UI font. The document
base consumes equivalent aliases. [Styling guide](styling.md) records ownership
rules. No component migration has started. Browser capture was attempted, but
no browser is connected in this session; the visual baseline remains pending
before the navigation pilot.

Header pilot follow-up: `header-navigation.css` now owns the existing explorer
header back-control rules. Duplicate overrides were consolidated; chrome-wide
button defaults explicitly exclude this control using zero-specificity `:where`
so other controls retain their original selector specificity. Label background
overrides no longer need `!important`. Markup, refs, class hooks, typography,
480px adaptation, focus geometry, and disabled/hover behavior are preserved.
Contextual spatial navigation and playback remain unchanged.

Deviation: the source-only consolidation proceeded without a browser baseline
because no browser is connected. Visual equivalence remains unverified; review
this pilot before broadening component migrations. Build and lint passed
(existing lint and bundle-size warnings); whitespace checks passed. `npm test`
stopped at `tests/listening-state.mjs:50`: the violin landscape placement expects
top/center/gap 2 while the current configuration returns left/start/gap 1. This
assertion reads configuration independently of CSS; neither its input nor its
expectation was changed by this pilot.

Playback pilot follow-up: `playback-controls.css` owns the playback button,
native slider styles, invitation animation/reduced-motion rule, and responsive
transport gap/padding. The playback button now opts out of chrome-wide defaults;
its effective default and disabled colors are preserved. Redundant radius,
padding, and ineffective disabled-color utilities were removed from JSX.
Progress, pulse-bar scale, seeking, accessible names, and domain state were not
changed. Footer integration and the full-orchestra lock remain as before.
Build, lint (existing warnings), and whitespace checks passed. The existing
focused playback check passed, covering transport/time, beat pulses, and
navigation independence. The full-suite caption failure above remains unresolved.
An initial combined focused run passed playback but could not complete navigation
because its caller omitted the required selection callback; it is not counted
as a navigation test pass. Browser and native slider visual review remain pending.

Lock follow-up: `full-orchestra-lock.css` now owns the remaining header control's
appearance, allowing removal of chrome-wide button appearance defaults entirely.
Model credits retain their own existing rule. Lock JSX no longer advertises
pressed colors, radius, minimum height, or mobile padding that the cascade
overrode. The effective values, icon changes, accessible state, and event handler
are preserved. Existing pointer-event integration rules remain map-owned.
Build, lint (existing warnings), and whitespace checks passed. No new behavior
was introduced; browser review remains pending. A more prominent pressed-state
treatment and target sizing need visual review rather than being silently
introduced through removal of the old overriding selector.

Loader/credits follow-up: shared loader styles and reduced-motion rules now live
in `src/components/loader.css`; credits appearance lives beside `ModelCredits.tsx`
in `model-credits.css`. Explorer-relative footer placement stays in global layout
rules. Credits toggle resets were consolidated to their effective values,
including the zero minimum height that previously overrode both desktop and
mobile declarations. Dialog semantics, content, links, focus handling, and
component markup are unchanged. Build, lint (existing warnings), and whitespace
checks passed. Browser review and a deliberate credits target-size review remain
outstanding; no new accessibility compliance claim is made.

Debug follow-up: camera capture, lighting/pose, hotspot editing, and the editing
marker outline moved unchanged to `debug/instrument-debug.css`. A source
comparison against the original rules confirmed an exact match. Central CSS
importing is retained; this is an ownership extraction, not conditional loading
or a bundle-size optimization. Map debug and listening diagnostics already own
their styles through local utilities and remain unchanged. Build, lint (existing
warnings), and whitespace checks passed. Browser review remains pending.

Explorer follow-up: public rules moved without declaration changes into
`instrument-explore.css`, `viewer/anatomy-controls.css`, and
`demonstration/demonstration.css`. Related rules preserve their relative order,
including description/entry transforms, anatomy states, and reduced-motion
overrides. Explorer footer-relative credits placement moved with explorer
layout. Cross-experience map miniature and transport visibility rules stay
map-owned. Build, lint (existing warnings), whitespace checks, and
`npm run test:spatial` passed. The spatial suite includes inspector/resource
lifecycle, explorer layout, typography, placement, framing, and model extent.
The first sandboxed spatial run reported a socket permission error despite
passing assertions; a subsequent permitted run passed cleanly. No specs or
behavior were changed. Browser review is still outstanding, and the separate
full-suite violin caption expectation remains unresolved.

Map follow-up: all remaining map rules moved unchanged and in the same order
to `features/orchestra-map/orchestra-map.css`, including cross-experience
integration, responsive/reduced-motion rules, and late caption overrides.
Global CSS is now 56 lines of imports and foundations. The 940-line map file
remains deliberately intact to avoid an unverified cascade regrouping; smaller
feature files alone would not remove its underlying complexity. Build, lint
(existing warnings), and whitespace checks passed. No domain logic changed,
so the already recorded spatial checks were not repeated for this extraction.
Browser review remains pending, as does the unrelated full-suite assertion.

The source-ownership extraction is now complete. Further work should focus on
reviewing actual visual states, consolidating demonstrated shared values and
patterns, and providing a development preview rather than merely moving more
rules between files. Shared components and the remaining token scales are not
yet complete.

Foundation/preview follow-up: repeated 0.7rem control labels, 0.04em tracking,
0.55rem horizontal insets, and white 2px focus treatments now use shared tokens
in migrated controls without changing values. Component-specific focus offsets
and identity typography remain distinct. A development-only `/?style-preview`
entry provides semantic swatches, typography, live loader/lock components, and
explicitly labeled interactive style specimens. Preview startup skips audio
connection and route synchronization and does not mount the scene. Build, lint
(existing warnings), whitespace checks, and inspection of emitted tokens and
production JavaScript passed: preview JavaScript is absent from production.
Browser discovery still returns no connected browser, so responsive visual and
focus review remain pending. Shared component extraction and expanded scales
remain future work based on that review.

Tailwind-first correction: source extraction improved ownership but left too
many ordinary declarations in CSS. The agreed direction is now to migrate
ordinary layout, typography, colors, borders, and interaction states into
token-based utilities, retaining CSS for specialized selectors and visuals.
`FullOrchestraLock.tsx` is the first example: its CSS file is removed and the
existing effective appearance is expressed in utilities. The global unlayered
font-inheritance reset excludes this component so it cannot override the
utility font size; other controls retain their previous reset. Tailwind's base
preflight provides the migrated control's font inheritance. No visual redesign,
pressed-color change, event, or domain-state change is included.
Build, lint (existing warnings), and whitespace checks passed. Generated CSS
was inspected to confirm token-based padding, font size, tracking, and focus
utilities are emitted and the removed lock appearance selector is absent.
Browser review remains pending. The existing development preview uses this
live component, so the pilot can be reviewed at `/?style-preview`.

## Tailwind migration across the interface

Ordinary styling now lives in utilities across header navigation, playback,
credits, loader geometry, explorer stage/content/anatomy, demonstrations, map
chrome/labels/caption defaults, debug forms, the development preview, and static
prototype layout. Header, credits, and preview appearance stylesheets were
removed. `HeaderBackButton` shares the actual header control with the preview;
`DebugButton` shares the repeated editor-button treatment. Domain state,
navigation callbacks, accessible names, native dialog behavior, class hooks,
and runtime property ownership remain with their existing systems.

The redundant global control-font reset was removed in favor of Tailwind
preflight, allowing typography utilities to take effect. Existing inclusive
480px, 600px, and 820px conditions are preserved with explicit media variants.
Unused explorer identity/anatomy/technique and map Explore-link/loader rules
were removed after confirming there are no source consumers. The live
keyboard-target and scene-error presentation rules remain intact.

Retained CSS covers pseudo-elements, native range parts, coordinated animation
and reduced-motion behavior, projected transforms, artwork masking, luminous
surfaces, imperatively created canvases, and complex spatial/fallback states.
Custom stylesheet source fell from 1,984 to about 980 lines in this pass;
this is an ownership improvement, not a claim that utility class strings reduce
the JavaScript payload. No dependencies or product/specification changes were
introduced. See the current guide for the concrete ownership table.

Validation:

- Build, lint, and whitespace checks pass; existing lint and chunk-size warnings
  remain.
- `npm run test:spatial` passes, covering inspector/resources, projection,
  typography, framing, and responsive spatial composition.
- Existing focused navigation-motion, playback, demonstration coordination,
  hotspot/editor, and attribution checks pass independently.
- `npm test` still stops at the pre-existing violin caption expectation at
  `tests/listening-state.mjs:50` (top/center/gap 2 versus left/start/gap 1).
  Neither that configuration nor the test expectation was changed.
- Generated CSS was inspected for token-based typography/focus/loader geometry,
  inclusive breakpoints, group/backdrop states, the 16px editor-input floor,
  native slider selectors, and the preserved playback entrance animation.
  Removed appearance selectors and preview JavaScript are absent from production.
- Browser discovery returns no connected browser. Screenshot comparison,
  keyboard/touch interaction review, and visual verification over the real
  scene remain pending; automated checks do not replace that review.

## Development React hook error follow-up

After the migration, the lazy-loaded model reported a null React hook dispatcher.
Its hook usage is valid and npm resolves one installed React version. A likely
cause was shared Vite cache interference: config-less SSR tests/tools were
running browser dependency optimization against the same default cache as the
live dev server. The agent's test runs and extra preview server could contribute
to this interference.

The dev app now uses `node_modules/.vite/app`; both SSR test runners and the three
SSR audio tools disable browser dependency discovery/optimization. The extra
agent-started preview server was stopped. Build, lint (existing warnings), and
spatial/model checks pass. A before/after hash comparison confirms the spatial
run leaves all dependency-cache metadata unchanged. Browser recovery still needs
a full page reload; the reported hook error cannot be verified directly without
a connected browser. No model hooks or component behavior were changed for this fix.

## Staged instrument-preparation hint

(Since removed: selection is taught by the floating constellation onboarding, and preparation by the floating `PreparingIndicator.tsx`; see `specs/orchestra-map.md`.)

`ExplorationHint.tsx` now reserves both text layouts and overlays a single glyph
between measured idle/preparing slots. Selection fades the old copy for 180ms;
its animation-end starts the orbit while a 350ms slide moves the glyph right;
preparation copy fades in over 200ms after that slide. Font/resize observation
keeps the slots aligned. Keyed visual sequences reset cleanly on cancel/retry,
and a separate accessible status updates immediately. Reduced motion shows the
final static preparation state and retains the existing immediate-ready entry.
Existing model readiness and orbit-cycle completion still gate exploration.
The preview has an independent preparation toggle. Build, lint (existing
warnings), spatial tests, and whitespace checks pass. Browser timing/visual
review remains pending; no connected browser was available.

Return-animation correction: remounting the hint on loading changes caused the
cluster and copy to snap back on Back. The hint now remains mounted and uses an
interruptible GSAP sequence in both directions: fade the current copy, travel
between measured slots, reveal the destination copy. Cleanup kills the timeline
without reverting its rendered values. A scalar progress property keeps slot
measurements responsive while traveling. Reduced-motion changes settle
immediately, and the accessible status still updates without animation delay.
Build, lint (existing warnings), and whitespace checks pass. The existing preview
toggle exercises both directions; browser visual verification remains pending.

Family-caption follow-up: the outgoing hint clone omitted its caption name,
reserving “Preparing instrument” instead of the live caption's “Preparing Brass”.
Since hidden preparation text participates in measurement, the departing clone
could jump despite the hint's own animation being continuous. Outgoing hints now
receive the same state-derived name as their live counterpart. Build and
whitespace checks pass; browser confirmation remains pending.

## Intent and constraints

Keep the bespoke cultural/editorial identity described in [vision.md](vision.md).
The accepted [architecture](architecture.md#styling) uses Tailwind, project tokens,
and custom components, without a full visual component library. This work
implements that direction rather than replacing the stack or redesigning the UI.
Feature behavior remains governed by the specifications in `/specs`.

## Current inventory

| Area | Current implementation | Finding |
|---|---|---|
| Entry and foundations | `src/main.tsx` imports the sole application stylesheet, `src/styles/global.css` (1,888 lines at audit time) | Foundations, feature rules, shared UI, and debug styling have one global scope. |
| Tokens | Tailwind v4 `@theme` defines an identity font and named colors | A useful starting palette exists; semantic roles and other foundations are incomplete. |
| Typography | System UI body font, locally hosted Atlas Identity font, component-specific sizes and tracking | Separate identity typography from ordinary labels, body copy, and numeric readouts before consolidating sizes. |
| Map shell and navigation | Utilities in `OrchestraMap.tsx`, plus `.map-chrome`, header, caption, and contextual-navigation selectors | Parent selectors and late overrides make local styling difficult to predict. |
| Playback | Utilities in `PlaybackControls.tsx` and `FullOrchestraLock.tsx`; global range-input, state, responsive, and animation rules | Good pilot for clarifying style ownership, but preserve native range behavior and runtime progress. |
| Instrument explorer | Named global selectors for canvas, anatomy, actions, demonstrations, typography, and credits | Most styles belong to the feature; spatial placement is not a generic UI primitive. |
| Shared loading | `src/components/Loader.tsx` with global ripple styles and a size custom property | Already a small shared component; suitable for later foundation alignment. |
| Development tools | Debug panels and hotspot-editor rules share the production stylesheet; diagnostics use utilities | Keep separate ownership from public UI; do not expand the initial component system around developer controls. |

## Concrete inconsistencies and dependencies

- `.map-chrome button` supplies typography, padding, colors, and resets to all
  descendant buttons. These unlayered rules can override Tailwind utilities,
  including a component's declared minimum height or radius.
- `.map-chrome .map-header-back` appears in multiple places, with later color
  and hover rules changing earlier definitions. Consolidation must preserve the
  final computed result, rather than simply retaining the first declaration.
- Playback layout lives in JSX while its mobile gap and padding are overridden
  in CSS at 600px. Ownership is split even for the same properties.
- Focus treatments use both outlines and box shadows, with different offsets.
  These may be intentional for clipping or geometry; audit them before choosing
  shared defaults. No contrast or target-size compliance claim has been made.
- Raw colors remain in CSS and utilities alongside palette tokens, including
  navigation text, pressed controls, disabled controls, and translucent surfaces.
  Similar-looking values should be compared visually before merging.
- Responsive rules include 480px, 600px, 719px, and 820px cutoffs and orientation
  queries. These describe different constraints; do not merge them mechanically.
- Reduced-motion rules are already distributed beside bespoke animations.
  Preserve those pairings when moving styles.
- CSS, GSAP, and imperative DOM updates share animation-related properties.
  `PlaybackControls.tsx` explicitly writes the individual `scale` property to
  replace its utility default. Moving that default to `transform` would change
  composition. Spatial overlays likewise require independent transform owners.
- Some selectors are also runtime hooks. Renaming classes requires checking
  TypeScript queries and animation code, not just JSX and CSS.
- The canvas background token documents a tone-mapping relationship to the
  Three.js background. Treat it as an integration constraint.

## Proposed styling contract

1. **Foundations:** shared tokens and base document styles in `src/styles/`.
   Keep existing palette values initially; introduce semantic aliases for
   demonstrated roles such as primary/secondary text, surfaces, and focus.
2. **Ordinary composition:** Tailwind utilities for layout and token-based styling.
   Avoid repeated arbitrary values for established shared roles.
3. **Owned visual treatments:** component or feature CSS for complex states,
   pseudo-elements, native-control styling, and bespoke animation. Prefer
   selectors owned by the component over parent-wide element rules.
4. **Runtime values:** inline styles, CSS custom properties, and imperative writes
   remain valid for projection, progress, and animation. Document the owner of
   properties that multiple systems could otherwise write.
5. **Cascade:** preserve current order during extraction. Introduce deliberate
   layer ordering only in a separately verified change; moving unlayered rules
   into a layer can change their precedence against utilities.

This contract is a proposal for the next step, not an already completed migration.

## Small design-system scope

Begin with semantic color roles, UI typography roles, common spacing and control
sizes, radii, focus treatment, and ordinary UI transition timings. Preserve
specialized identity typography, spatial dimensions, family color treatments,
and navigation choreography in their owning features.

Extract shared React components only when repeated markup and behavior justify
them. Candidates are ordinary buttons, icon buttons, and contextual navigation.
Playback, spatial captions, anatomy markers, and demonstration panels retain
their domain behavior and feature ownership. Do not add dependencies or a full
component catalogue for this work.

## Sequence and review gates

1. **Audit (this document):** source inventory and dependency findings complete.
   Browser screenshots and computed-style baselines remain outstanding.
2. **Foundations and baseline:** capture the review matrix below; document the
   styling contract and introduce a minimal set of semantic aliases without
   changing values. Link the guide from the documentation map.
3. **Navigation pilot:** isolate current header/back-control styling, preserving
   measured layout, selector hooks, interaction states, and cascade results.
   Review before extending the approach to playback.
4. **Playback pilot:** give control styles explicit ownership; preserve scrubber
   behavior, pulse animation, lock states, and responsive composition.
5. **Incremental extraction:** move explorer, map, shared loader, and debug CSS
   into their owning locations in small independently reviewable changes.
6. **Consolidation:** remove verified obsolete rules, align repeated values with
   foundations, and add a lightweight development preview of actual shared UI.

Each implementation step should remain visually neutral unless a specific
visual or accessibility correction is explicitly identified for review.

## Validation baseline to capture before implementation

| Surface | States and conditions |
|---|---|
| Map/navigation | Root, family, instrument; back navigation; keyboard focus; loading/ready; model-preparation error where reproducible |
| Playback | Before start, playing, paused, locked/unlocked; pointer and keyboard seeking; unavailable recording where reproducible |
| Explorer | Model loading/ready/error; anatomy selection; action controls; demonstration; credits dialog |
| Responsive | Desktop landscape, tablet, mobile portrait and landscape; inspect both sides of affected media-query boundaries |
| Accessibility/motion | Visible focus, meaningful accessible names, touch targets, reduced motion; inspect UI over actual scene backgrounds |

Capture screenshots before and after each visual migration and inspect computed
styles for affected controls. Run `npm run build`, `npm run lint`, and relevant
existing tests after implementation; use `npm test` for navigation/listening
changes and `npm run test:spatial` if measured overlay layout is affected.
Review slider rendering in Chromium and Firefox when changing its pseudo-elements.

## Outstanding decisions

- Exact semantic aliases and typography scale should follow the baseline review.
- Shared component APIs should follow the pilots rather than precede them.
- Visual changes, breakpoint consolidation, and expanded accessibility fixes
  need explicit scope; they are not implied by moving styles.

This audit is source-based. Browser review, screenshots, contrast measurements,
and runtime validation have not yet been performed.
