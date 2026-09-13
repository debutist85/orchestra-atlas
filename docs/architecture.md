# Orchestra Atlas — Technical Architecture

## Purpose

This document defines the technical foundations of Orchestra Atlas.

It describes:

- accepted architectural decisions
- boundaries between major systems
- technical principles
- source-code organization
- provisional choices
- areas that require prototyping before a final decision

This document should remain relatively stable compared with feature specifications, but it is not immutable.

Architecture may evolve when prototypes or implementation work reveal a better approach.

Important architectural changes should be documented rather than introduced silently.

---

## Architectural Goals

The technical architecture should support:

- a highly interactive client-side web experience
- synchronized 3D, audio, notation, video, and UI
- responsive behavior across desktop, tablet, and mobile
- accessible alternatives to spatial and audio-dependent interfaces
- high performance on a range of devices
- data-driven content
- iterative prototyping
- modular subsystems with clear boundaries
- feature-oriented development
- future expansion without premature abstraction

The architecture should optimize for clarity and maintainability rather than maximum framework complexity.

---

# Core Stack

## Application Foundation

### Decision

Use:

- Vite
- React
- TypeScript

### Why

Orchestra Atlas is primarily a rich client-side application.

The core experience depends heavily on:

- WebGL
- Web Audio
- interactive state
- motion
- media synchronization
- responsive client-side interfaces

The project currently has no meaningful requirement for server-side rendering.

Vite provides a lightweight development and build environment without introducing server-oriented application architecture that is not currently needed.

React provides the main application UI layer.

TypeScript should be used throughout production application code where practical.

### Status

Accepted

---

# Rendering Architecture

## Three.js

### Decision

Use plain Three.js directly for the initial orchestra-installation prototype.

Do not introduce React Three Fiber initially.

### Why

- existing developer familiarity with Three.js
- direct access to scene, camera, materials, rendering, and animation
- fewer abstraction layers during early visual prototyping
- easier to reason about rendering behavior while interactions are still being discovered
- avoids prematurely coupling the 3D scene to React component structure

### Important Principle

React should not own the internal runtime state of the Three.js scene.

Three.js should consume semantic application state and translate it into rendering behavior.

For example:

```text
selectedSection = "strings"
```

may cause Three.js to:

```text
highlight string players
dim other sections
animate spatial separation
adjust camera framing
```

The shared application store should not contain implementation-level rendering values such as:

```text
material opacity
camera interpolation progress
mesh position tween values
bloom intensity
```

Those remain internal to the rendering system.

### Future Review

React Three Fiber may be reconsidered after the first orchestra-installation prototype.

The decision should be based on demonstrated integration needs rather than framework preference.

### Status

Accepted for prototype phase

---

# Shared Application State

## Decision

Use Zustand for shared semantic application state.

### Why

The project requires state to be shared between multiple systems, including:

- React UI
- Three.js
- audio
- score rendering
- video
- responsive interfaces

Shared state should live outside any individual rendering layer.

Zustand provides:

- a small API
- React integration
- easy access from non-React systems
- subscriptions suitable for Three.js and audio systems
- minimal architectural overhead

### Example

Shared application state may eventually contain concepts such as:

```ts
selectedSection
selectedInstrument
selectedTechnique
currentExcerpt
playbackMode
isPlaying
currentMusicalPosition
```

Systems consume that semantic state independently.

For example:

```text
selectedSection = "woodwinds"
playbackMode = "highlight"
```

may result in:

```text
React
→ display Woodwinds as selected

Three.js
→ visually emphasize woodwinds

Audio engine
→ keep woodwinds at full level and attenuate other sections

Score
→ emphasize relevant staves
```

### State Boundaries

Not all state belongs in Zustand.

Use shared state for application meaning.

Use feature-local or React component state for UI state that does not need to be shared.

Use internal subsystem state for high-frequency implementation details such as:

- animation interpolation
- audio node internals
- WebGL rendering state
- temporary gesture state
- frame-by-frame calculations

Avoid pushing 60 FPS rendering or audio values through React or the shared store unnecessarily.

### Status

Accepted

---

# State Ownership Principle

The source of truth for application state must not be embedded inside:

- Three.js objects
- DOM components
- audio nodes
- score-rendering components
- video elements

For example, avoid treating:

```ts
mesh.userData.selected = true
```

as the authoritative record of section selection.

Instead:

```text
shared application state
        ↓
Three.js representation
React representation
audio representation
score representation
```

The same principle applies in reverse.

Interactions inside any subsystem should update shared semantic state rather than requiring other systems to query that subsystem.

For example:

```text
User selects Strings in Three.js
        ↓
shared state changes
        ↓
React UI updates
audio system reacts
score reacts
Three.js reflects selected state
```

and:

```text
User selects Strings in HTML UI
        ↓
same shared state changes
        ↓
same consumers react
```

The interaction source should not determine where application truth lives.

---

# Source Organization

## Decision

Organize application code primarily by feature.

Each meaningful product feature should own its feature-specific:

- components
- hooks
- configuration
- utilities
- types
- rendering code
- state
- supporting modules

Features should contain only the internal directories they actually require.

Do not create empty directory structures merely for consistency.

### Initial Structure

A likely project structure is:

```text
src/
├── app/
│   ├── App.tsx
│   └── ...
│
├── features/
│   ├── orchestra-installation/
│   │   ├── components/
│   │   ├── three/
│   │   ├── hooks/
│   │   ├── config/
│   │   ├── utils/
│   │   ├── types/
│   │   └── index.ts
│   │
│   ├── instrument-explorer/
│   ├── technique-explorer/
│   ├── interactive-score/
│   └── repertoire/
│
├── components/
├── hooks/
├── lib/
├── store/
├── styles/
├── types/
│
└── main.tsx
```

This structure is illustrative rather than mandatory.

Directories should emerge from actual implementation requirements.

---

## Feature Ownership

Code belongs to a feature by default.

For example:

```text
features/
└── orchestra-installation/
    ├── components/
    │   ├── OrchestraInstallation.tsx
    │   └── SectionLabel.tsx
    │
    ├── three/
    │   ├── createOrchestraScene.ts
    │   └── orchestraLayout.ts
    │
    ├── config/
    │   └── sections.ts
    │
    └── index.ts
```

Three.js-specific implementation for the orchestra installation belongs inside the feature rather than inside a global `three/` directory merely because it uses Three.js.

The same principle applies to other specialized systems.

For example:

```text
features/
├── orchestra-installation/
│   └── three/
│
├── instrument-explorer/
│   └── three/
│
├── repertoire-experience/
│   └── audio/
│
└── interactive-score/
    └── score/
```

Do not create global technical directories such as:

```text
src/three/
src/audio/
src/score/
```

until there is genuinely shared infrastructure that belongs there.

---

## Shared Code

Code should remain feature-local by default.

Move code into shared top-level directories only when it represents a genuine cross-feature abstraction.

Shared code should earn its way out of a feature.

### Shared Directories

Use top-level directories approximately as follows:

```text
src/components/
```

Reusable application-wide UI components.

Examples might eventually include:

```text
Button
IconButton
Panel
SpatialLabel
MediaControls
```

---

```text
src/hooks/
```

Hooks that are genuinely useful across multiple features.

Feature-specific hooks remain inside their feature.

---

```text
src/lib/
```

Shared framework-independent utilities, integrations, or infrastructure.

Examples might eventually include:

```text
math
media
timing
asset-loading
```

Do not use `lib/` as a miscellaneous dumping ground.

---

```text
src/store/
```

Cross-feature application/domain state.

Examples may eventually include:

```text
selection
playback
current repertoire context
shared musical timeline state
```

Feature-local state should remain inside the relevant feature when it does not need to be globally shared.

---

```text
src/types/
```

Types genuinely shared across features or infrastructure.

Feature-specific types remain inside their feature.

---

```text
src/styles/
```

Global styles, design tokens, typography, and other application-wide visual foundations.

---

## Avoid Premature Extraction

Do not extract something into shared code simply because it might theoretically be reused later.

For example:

```text
features/orchestra-installation/utils/
└── calculateArcPositions.ts
```

should remain inside the orchestra-installation feature while its behavior is specific to that experience.

If another feature later requires the same underlying concept, reconsider ownership at that point.

Likewise:

```text
features/orchestra-installation/components/
└── SectionLabel.tsx
```

should not become a global component until a real shared abstraction has emerged.

Prefer duplication during early discovery over a premature abstraction that incorrectly couples features.

Small amounts of temporary duplication are acceptable during prototyping when the correct abstraction is not yet understood.

---

# Feature Boundaries

Each feature should expose a deliberate public API through its root `index.ts`.

External code should prefer importing from the feature root.

For example:

```ts
import {
  OrchestraInstallation,
  type OrchestraSectionId,
} from "@/features/orchestra-installation";
```

Prefer this over:

```ts
import { OrchestraInstallation } from
  "@/features/orchestra-installation/components/OrchestraInstallation";
```

The feature root acts as its public boundary:

```text
outside feature
      ↓
feature/index.ts
      ↓
feature internals
```

This makes dependencies between features more explicit.

Deep imports across feature boundaries should be treated as a signal that:

- the feature's public API may need to expose something deliberately;
- ownership of the imported code may be incorrect; or
- a genuinely shared abstraction may have emerged.

Feature internals may import each other directly when appropriate.

The public-boundary rule primarily applies to consumers outside the feature.

---

# Barrel Exports

## Decision

Use barrel exports where they create useful module boundaries.

The most important barrel is the feature's root `index.ts`.

For example:

```ts
// features/orchestra-installation/index.ts

export { OrchestraInstallation } from "./components";
export type { OrchestraSectionId } from "./types";
```

Major internal modules may also use barrels where this improves clarity.

For example:

```text
orchestra-installation/
├── components/
│   ├── OrchestraInstallation.tsx
│   ├── SectionLabel.tsx
│   └── index.ts
│
├── types/
│   ├── orchestra-section.ts
│   └── index.ts
│
└── index.ts
```

Do not add `index.ts` files mechanically to every directory.

Avoid barrel structures that:

- obscure where dependencies originate
- expose internal implementation accidentally
- create circular imports
- make dependency tracing unnecessarily difficult

Barrels should represent intentional APIs rather than simply shortening import paths.

### Status

Accepted

---

# State Organization

Shared Zustand state and feature-local state should follow the same ownership rules as other code.

## Cross-Feature State

State that represents application-wide meaning belongs in the shared application store.

Examples:

```text
selectedSection
selectedInstrument
selectedTechnique
currentExcerpt
playbackMode
playback status
shared musical position
```

A future structure might resemble:

```text
src/
└── store/
    ├── useAppStore.ts
    └── slices/
        ├── selectionSlice.ts
        └── playbackSlice.ts
```

This structure should not be created until complexity justifies it.

## Feature-Local State

State used only by one feature should normally remain with that feature.

For example:

```text
features/
└── instrument-explorer/
    └── store/
        └── ...
```

may be appropriate if that feature eventually requires substantial local state.

Simple UI state may remain directly inside React components.

## Subsystem State

Implementation-level runtime state should remain inside the subsystem that owns it.

For example:

```text
selectedInstrument
→ shared domain state

isAnatomyPanelExpanded
→ feature/component state

orbTransitionProgress
→ Three.js internal state

AudioBufferSourceNode
→ audio subsystem state
```

Do not centralize state merely for the sake of centralization.

---

# Styling

## Decision

Use Tailwind CSS for application styling and layout.

Use project-specific design tokens and custom visual components.

Do not adopt a full visual component library.

### Why

Orchestra Atlas requires a bespoke visual identity.

The interface should feel closer to a contemporary cultural institution or installation than a conventional application dashboard.

Tailwind supports:

- fast iteration
- responsive design
- custom visual systems
- utility-driven styling without imposing a visual language

### Design Tokens

Define shared tokens for concepts such as:

- color
- typography
- spacing
- radii
- motion
- elevation
- breakpoints
- focus treatment

Tokens should be explicit rather than allowing arbitrary visual values to proliferate throughout the codebase.

### Status

Accepted

---

# Headless UI Primitives

## Decision

Use Radix UI selectively for accessible headless interaction primitives.

### Appropriate Use

Radix may be used for interactions such as:

- dialogs
- popovers
- tooltips
- tabs
- menus
- dropdowns
- accessible overlays
- focus management

### Principles

Radix provides behavior and accessibility, not the visual identity of Orchestra Atlas.

Components should be visually styled using the project's own design system.

Do not introduce Radix components simply because they exist.

Use them when they reduce the risk or complexity of implementing robust accessible behavior.

Radix packages should be installed individually when a concrete component requires them.

Do not install the entire Radix ecosystem during initial scaffolding.

Do not adopt a full visual component library unless this architecture is explicitly reconsidered.

### Status

Accepted

---

# Component Architecture

React components should primarily handle:

- semantic UI structure
- user interaction
- responsive presentation
- accessibility
- application-level controls
- coordination with shared state

Avoid placing substantial domain content directly inside components.

Prefer components that receive structured data.

For example:

```tsx
<InstrumentPanel instrument={instrument} />
```

rather than hardcoding instrument-specific content throughout the component tree.

Reusable components should emerge from repeated real needs.

Do not create generic component abstractions solely because they might be useful in the future.

---

# Domain Model

The domain model should represent musical and content concepts independently from rendering systems.

Likely domain entities include:

```text
Orchestra
Section
Instrument
InstrumentFamily
Technique
RepertoireWork
Excerpt
Score
ScoreEvent
Recording
Video
MediaAsset
RightsMetadata
```

Relationships between entities are important.

For example:

```text
Instrument
    ↓
Technique
    ↓
Score Event
    ↓
Excerpt
    ↓
Recording
```

Navigation may also operate in the reverse direction.

The exact schemas should emerge through content-model work rather than being fully designed upfront.

### Status

Principle accepted; schemas to be defined incrementally

---

# Content Architecture

Content should be data-driven.

Avoid storing substantial musical, descriptive, or rights information directly inside UI code.

A future structure may include:

```text
content/
├── instruments/
├── techniques/
├── repertoire/
├── recordings/
├── scores/
└── media/
```

The precise file format is not yet fixed.

Possible representations include:

- TypeScript data
- JSON
- Markdown with structured front matter
- generated structured data
- a combination of these

The initial implementation should prefer simple local structured content.

A CMS should not be introduced unless the project demonstrates a real need for one.

### Status

Partially decided

---

# 3D Asset Pipeline

## Primary Format

Use glTF / GLB as the primary runtime format for 3D assets.

### Why

glTF is well suited to real-time web delivery and integrates naturally with Three.js.

## Asset Preparation

Source assets may originate in other formats.

Use Blender or equivalent tooling as necessary to:

- clean geometry
- remove unnecessary hidden geometry
- normalize scale
- normalize orientation
- configure origins
- simplify materials
- reduce polygon count
- optimize textures
- create meaningful object hierarchy
- rename important parts semantically
- export production GLB files

## Semantic Model Structure

Where practical, models should expose meaningful named parts.

For example:

```text
Violin
├── Body
├── Fingerboard
├── Bridge
├── Tailpiece
├── Strings
├── Pegbox
├── Scroll
├── Chinrest
└── Bow
```

This makes anatomy and technique highlighting more robust than screen-space annotations attached to arbitrary coordinates.

## Optimization

Consider:

- geometry complexity
- texture dimensions
- texture compression
- memory consumption
- draw calls
- asset loading
- mobile GPU limits

Potential optimization technologies such as Meshopt, Draco, or KTX2 should be evaluated when production assets demonstrate a need.

Do not introduce them before they solve a measurable problem.

### Status

GLB accepted; detailed optimization pipeline provisional

---

# Three.js Scene Architecture

The Three.js scene should be treated as a rendering subsystem with a clear boundary.

A possible conceptual structure is:

```text
Application State
      ↓
Scene Controller / Adapter
      ↓
Three.js Scene
├── Orchestra Layout
├── Selection Visualization
├── Musical Activity Visualization
├── Camera System
├── Lighting
└── Animation System
```

The exact code structure should emerge from the first prototype.

Avoid making a single large scene file responsible for:

- domain data
- interaction state
- rendering
- audio
- DOM updates
- routing
- content loading

Keep these responsibilities separable.

Feature-specific Three.js code should live inside the feature that owns the experience.

Only extract Three.js infrastructure into shared code when multiple features demonstrate a genuine need for the same abstraction.

---

# Animation

Animation should communicate meaning.

Potential responsibilities include:

- section selection
- spatial emphasis
- camera reframing
- instrument focus
- playback visualization
- technique demonstrations
- transitions between experience layers

High-frequency visual animation should generally run inside the rendering layer rather than through React state updates.

Animation systems should respond to semantic targets.

For example:

```text
selectedSection = "brass"
```

should establish a new target visual state.

The animation layer decides how to interpolate toward that state.

## Animation Library

No general-purpose animation library is selected yet.

Potential options may include:

- native `requestAnimationFrame`
- Three.js animation systems
- GSAP
- Motion for DOM-focused UI

A library should be introduced only when concrete animation requirements justify it.

### Status

Undecided

---

# Audio Architecture

Audio is a core subsystem and should not be implemented as incidental media playback.

## Goals

The audio architecture should support:

- real orchestral recordings
- isolated technique samples
- synchronized stems where available
- section or instrument highlighting
- Full / Highlight / Solo modes
- synchronization with score and visual activity
- responsive playback controls

## Likely Foundation

Prefer the Web Audio API for core real-time audio behavior.

Do not rely on loosely synchronized independent `<audio>` elements for material requiring precise multitrack synchronization.

A conceptual audio graph may eventually resemble:

```text
individual stems
      ↓
instrument / section buses
      ↓
master bus
      ↓
output
```

Example:

```text
Violin I ─┐
Violin II ├→ Strings Bus ─┐
Viola ────┤               │
Cello ────┤               │
Bass ─────┘               │
                          ├→ Master
Woodwinds ────────────────┤
Brass ────────────────────┤
Percussion ───────────────┘
```

This structure could support:

```text
Full
all buses at normal level

Highlight
selected bus at 0 dB
other buses attenuated

Solo
selected bus active
other buses muted or strongly attenuated
```

## Tone.js

Tone.js is not currently selected.

The Web Audio API should be evaluated first.

Introduce Tone.js only if it solves demonstrated scheduling, transport, or audio-graph needs without obscuring required low-level control.

### Status

Architecture direction accepted; implementation undecided

---

# Shared Musical Timeline

A shared representation of musical time will likely become a central architectural concept.

The following systems may need to synchronize against the same timeline:

- audio
- score
- orchestra visualization
- subtitles or annotations
- video
- repertoire interactions

Avoid allowing each subsystem to maintain unrelated notions of playback time.

A future timeline model may represent:

```text
playback time
musical measure
beat
score events
instrument entries
technique events
visual events
```

The timeline should represent semantic musical/playback state rather than exposing implementation details from a particular audio or rendering library.

The exact timeline architecture should be designed after prototyping synchronized audio and score behavior.

### Status

Important architectural requirement; design undecided

---

# Score Rendering

Interactive notation is a core planned feature, but the rendering technology is intentionally undecided.

## Requirements

A score solution should support, where practical:

- MusicXML
- high-quality notation rendering
- SVG or another inspectable output format
- measure identification
- staff identification
- programmatic highlighting
- playback synchronization
- interaction with score elements
- responsive presentation
- focused instrument views
- accessibility strategy

## Candidates

Potential candidates include:

- Verovio
- OpenSheetMusicDisplay

Do not select a library based solely on popularity.

A focused technical prototype should compare candidates against Orchestra Atlas requirements.

## Decision Process

```text
score requirements
      ↓
candidate evaluation
      ↓
prototype
      ↓
interaction test
      ↓
performance test
      ↓
decision
```

### Status

Undecided pending prototype

---

# Video

Video should be integrated as synchronized or contextual media where useful.

Use native web video capabilities unless more advanced requirements demonstrate the need for an additional library.

Potential concerns include:

- synchronized playback
- captions
- transcripts
- responsive display
- seeking
- poster frames
- loading strategy
- rights metadata

Do not introduce a complex video framework prematurely.

### Status

Native-first approach accepted

---

# Routing

The routing strategy is not yet fixed.

The early prototype may not require routing.

As the experience expands, routing may be useful for stable navigable states such as:

```text
/orchestra
/instruments/violin
/instruments/violin/techniques/pizzicato
/repertoire/example-work
```

React Router or an equivalent lightweight client-side router may be introduced when navigation structure requires persistent URLs.

Do not introduce routing solely because React applications commonly use it.

### Status

Undecided pending navigation design

---

# Responsive Architecture

Responsive behavior is part of the interaction model, not only CSS layout.

The architecture should support device-dependent presentations of the same semantic state.

For example:

```text
selectedSection = "strings"
```

may produce:

```text
Desktop
→ spatial section separation
→ contextual side panel

Mobile
→ reduced spatial movement
→ bottom sheet
→ touch-optimized controls
```

The same domain state should drive both experiences.

Avoid duplicating business logic between desktop and mobile interfaces.

Use responsive layout and interaction strategies while preserving shared semantic behavior.

---

# Accessibility Architecture

Accessibility is a system-level concern.

The WebGL canvas must not become the sole interface to important application state.

Where practical, the semantic application model should support both:

```text
Three.js representation
```

and:

```text
accessible DOM representation
```

For example:

```text
Orchestra
├── Strings
│   ├── Violin I
│   ├── Violin II
│   ├── Viola
│   ├── Cello
│   └── Double Bass
├── Woodwinds
├── Brass
└── Percussion
```

The DOM representation does not need to visually duplicate the 3D scene.

It must preserve meaningful navigation and information.

Accessibility considerations include:

- semantic HTML
- keyboard navigation
- screen readers
- visible focus
- reduced motion
- contrast
- captions
- transcripts
- alternatives to color-only communication
- alternatives to audio-only meaning
- touch target size

Target WCAG 2.2 AA where applicable.

---

# Performance

Performance is especially important because the application combines:

- WebGL
- media
- audio
- animation
- responsive UI
- potentially large assets

Performance should be measured rather than optimized only by intuition.

Potential concerns include:

- bundle size
- initial loading
- GLB size
- texture memory
- GPU load
- draw calls
- JavaScript main-thread work
- audio decoding
- media bandwidth
- mobile performance

## Principles

- lazy-load heavy experiences when appropriate
- avoid loading all instruments and media upfront
- optimize assets before adding complex runtime workarounds
- test on real mobile hardware
- provide graceful degradation where necessary

Do not prematurely reduce visual quality before measuring actual constraints.

---

# Loading Strategy

Large assets should be loaded intentionally.

The application will eventually contain:

- 3D models
- audio recordings
- stems
- score files
- images
- video

Use progressive and contextual loading rather than loading the entire atlas at startup.

The exact loading architecture should evolve as real asset sizes become known.

Potential strategies include:

- route-level lazy loading
- feature-level lazy loading
- preloading likely next content
- loading indicators tied to meaningful progress

### Status

Principle accepted; implementation undecided

---

# Error Handling

Media-heavy experiences can fail partially.

The architecture should allow graceful handling of cases such as:

- failed 3D model load
- failed audio load
- unavailable media source
- unsupported browser capability
- corrupted content
- slow network

Failure in one subsystem should not unnecessarily destroy the entire interface.

Error states should be understandable to users rather than exposed as technical exceptions.

---

# Browser Support

Primary support should target modern evergreen browsers.

Exact browser-support requirements should be documented once production functionality is clearer.

Important technologies to verify include:

- WebGL
- Web Audio
- modern JavaScript
- CSS features
- media codecs

The experience should degrade gracefully where a capability is unavailable.

### Status

Provisional

---

# Testing

Testing should focus on behavior that provides meaningful confidence.

## Initial Tooling

Likely candidates:

- Vitest for unit-level testing
- React Testing Library for UI behavior
- Playwright for end-to-end interaction testing

These tools should be confirmed when the initial application scaffold is created.

## Testing Priorities

Useful tests may cover:

- domain-state transitions
- shared-state behavior
- content validation
- playback-mode logic
- interaction behavior
- keyboard navigation
- routing when introduced
- feature public APIs where meaningful

Do not attempt to unit-test every visual detail of Three.js.

Visual and experiential quality requires human browser review.

## Accessibility Testing

Automated accessibility checks should be introduced where practical, but they do not replace manual review.

Potential tooling may include axe-based checks.

### Status

Tooling provisional

---

# Content Validation

Structured content should eventually have runtime or build-time validation.

This is especially important for:

- IDs
- references between entities
- media metadata
- score links
- licensing metadata
- required attribution

A schema-validation tool may be introduced when the content model stabilizes.

Possible options include:

- Zod
- JSON Schema

No validation library is selected yet.

### Status

Undecided

---

# Licensing Metadata Architecture

Media and external assets should maintain structured rights information.

A media record may eventually include concepts such as:

```ts
source
creator
license
licenseUrl
attribution
compositionRights
performanceRights
recordingRights
videoRights
modelRights
restrictions
verificationStatus
notes
```

The precise schema will be defined as part of the content model.

The application should distinguish between:

```text
discovered
researched
requires review
approved
rejected
```

An AI agent must not mark an asset as legally approved.

---

# Backend

No dedicated application backend is required for the initial project.

The early application should prefer static/local content and client-side behavior.

A backend may be introduced later if requirements emerge such as:

- user accounts
- dynamic content administration
- protected media
- analytics requiring custom processing
- server-side integrations
- persistent user data

Do not create backend infrastructure preemptively.

### Status

No backend for initial phase

---

# Deployment

Deployment provider is not yet selected.

The application should initially be deployable as a static frontend build.

Suitable providers may include platforms capable of hosting Vite static assets with CDN delivery.

Deployment choice should be made once the initial application exists.

Media-hosting requirements may eventually differ from application-hosting requirements because large audio, video, and 3D assets may benefit from separate storage/CDN strategies.

### Status

Undecided

---

# Analytics and Telemetry

Do not introduce analytics during the prototype phase unless a specific research need exists.

If analytics are introduced later, they should respect privacy and should measure meaningful product questions rather than collect data indiscriminately.

### Status

Not required initially

---

# Dependency Policy

Dependencies should be introduced because they solve a demonstrated problem.

Before adding a significant dependency:

1. identify the requirement;
2. determine whether the existing stack or browser platform already solves it;
3. evaluate maintenance and ecosystem health;
4. consider bundle and runtime impact;
5. compare realistic alternatives where appropriate;
6. prototype when the choice materially affects interaction or architecture;
7. document important architectural decisions.

Avoid installing dependencies speculatively.

The project should not accumulate libraries merely because agents find them convenient.

In particular, the initial scaffold should not automatically install:

- React Three Fiber
- routing
- animation libraries
- audio libraries
- score renderers
- content validation libraries
- every Radix package

These should be introduced when concrete requirements justify them.

---

# Decision Status

Use the following statuses in this document where useful:

```text
Accepted
Accepted for prototype phase
Provisional
Undecided pending prototype
Undecided
```

Important decisions should include enough reasoning that future contributors can understand why they were made.

---

# Current Architecture Summary

## Accepted

```text
Build / development
→ Vite

Application UI
→ React

Language
→ TypeScript

Source organization
→ feature-oriented

Feature boundaries
→ root barrel exports as deliberate public APIs

3D prototype
→ plain Three.js

Shared application state
→ Zustand

Styling
→ Tailwind CSS

Headless accessible UI primitives
→ Radix UI, installed selectively

3D runtime format
→ GLB / glTF

Initial backend strategy
→ no dedicated backend
```

## Direction Established, Implementation Not Final

```text
State organization
→ cross-feature semantic state globally shared
→ feature-specific state stays feature-local
→ subsystem implementation state stays inside subsystem

Audio
→ Web Audio API first
→ shared synchronized timeline
→ section/instrument buses where stemmed material permits

Content
→ structured and data-driven
→ local content initially

Accessibility
→ semantic DOM representation alongside 3D where needed

Responsive design
→ shared semantic state, device-appropriate presentation

3D architecture
→ rendering subsystem consuming application state

Shared code
→ extracted from features only after genuine reuse emerges
```

## Intentionally Undecided

```text
React Three Fiber
→ reconsider after first 3D prototype

Score renderer
→ prototype Verovio / OpenSheetMusicDisplay

Animation library
→ decide from demonstrated need

Routing
→ add when navigation structure requires it

Testing libraries
→ confirm during application scaffold

Content validation
→ introduce when schemas stabilize

Deployment
→ decide after initial application exists

Advanced asset compression
→ introduce after measuring real assets
```

---

# Architecture Review Triggers

Revisit architectural decisions when one of the following occurs:

- a prototype demonstrates that an assumption is wrong
- a subsystem cannot integrate cleanly with shared state
- feature boundaries produce undesirable coupling
- shared directories begin accumulating unrelated code
- deep cross-feature imports become common
- performance measurements reveal a significant problem
- responsive or accessibility requirements expose structural limitations
- a new dependency would substantially alter architecture
- content scale exceeds the current approach
- production deployment introduces new constraints

Architecture should evolve because evidence demands it, not because another technology appears more fashionable.

---

# Guiding Principle

The architecture should support the experience without becoming the experience.

Prefer the simplest technical structure that allows Orchestra Atlas to remain:

- expressive
- synchronized
- accessible
- responsive
- performant
- maintainable
- easy to iterate

Organize code around product capabilities rather than technical categories where practical.

Keep domain meaning independent from its visual, audio, or interface representation.

Technical sophistication should serve musical and interaction goals rather than become a goal in itself.