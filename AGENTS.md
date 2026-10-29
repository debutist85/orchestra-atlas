# Orchestra Atlas — Agent Instructions

Orchestra Atlas is an interactive web experience for exploring the symphonic orchestra through 3D, sound, motion, notation, and real musical performances.

This repository is developed collaboratively by a human designer/developer and AI coding agents.

## Source of Truth

Before making significant product, design, or architectural decisions, read:

- `docs/vision.md`
- the relevant file in `specs/` when one exists
- `docs/README.md` for the documentation map

The vision document defines the purpose, audience, experience principles, scope, and design direction of the project. Feature specifications in `specs/` describe approved current behavior.

Do not silently reinterpret or expand the product vision.

If an implementation decision conflicts with the vision or requires a meaningful product decision that is not documented, surface the issue rather than choosing a new direction implicitly.

---

## Working Principles

### Understand before implementing

For non-trivial changes:

1. Read the relevant documentation and specification.
2. Inspect the existing implementation before proposing changes.
3. Identify constraints and dependencies.
4. Propose a concise implementation plan.
5. Implement the smallest coherent change that satisfies the task.
6. Validate the result.
7. Summarize what changed and note any deviations or unresolved issues.

Do not begin large implementations from the task description alone without first inspecting the relevant context.

### Preserve product intent

Implementation convenience should not silently override interaction or design intent.

If a requested interaction is difficult, expensive, inaccessible, or technically risky, explain the trade-off and propose alternatives rather than replacing it with a simpler experience without discussion.

### Prefer focused changes

Avoid unrelated refactors, dependency changes, formatting changes, or architectural rewrites while implementing a feature.

Do not modify files unrelated to the task unless necessary.

If broader work appears necessary, explain why before expanding scope.

---

## Design and Interaction

Orchestra Atlas should feel like a contemporary, accessible cultural experience rather than a conventional educational website, dashboard, game interface, or generic WebGL demo.

Prioritize:

- musical understanding
- clarity
- exploration
- meaningful interaction
- restrained visual design
- responsive behavior
- accessibility
- performance

Avoid decorative technical effects that do not contribute to the experience.

3D, animation, audio processing, and other technical features should earn their complexity.

### Motion

Motion should communicate:

- hierarchy
- navigation
- musical activity
- spatial relationships
- state changes

Avoid animation that exists only for spectacle.

Respect reduced-motion preferences.

### Responsive design

Mobile is a first-class experience.

Do not treat desktop layouts as the canonical interface and mobile as a later reduction.

When implementing interactions, consider:

- desktop
- tablet
- mobile
- pointer input
- touch input
- keyboard input where applicable
- orientation changes
- device performance

Responsive behavior may differ across devices while preserving the same conceptual experience.

---

## Accessibility

Accessibility is part of the architecture and interaction design.

Do not rely exclusively on:

- WebGL
- color
- sound
- hover
- precise pointer input
- animation
- spatial understanding
- conventional music notation

Important application state represented inside a WebGL scene should have an accessible semantic representation in the surrounding web application where practical.

Use appropriate semantic HTML before adding ARIA.

Consider:

- keyboard navigation
- focus management
- visible focus states
- screen readers
- captions and transcripts
- reduced motion
- contrast
- touch target size
- alternatives to audio-only or visual-only information

Aim for WCAG 2.2 AA where applicable.

Do not "solve" accessibility by disabling the primary experience. Design equivalent ways to access its meaning.

---

## Architecture

Keep domain state independent from its visual representation.

In particular, avoid making Three.js objects, DOM components, audio nodes, or score-rendering components the sole source of application state.

Concepts such as:

- instruments
- sections
- techniques
- repertoire
- playback position
- selected instrument
- highlighted section
- score events

should be represented as application/domain data that different interfaces can consume.

This allows the 3D scene, accessible DOM interface, audio engine, score, and responsive UI to remain synchronized without becoming tightly coupled.

Prefer data-driven systems over hardcoded per-instrument or per-piece interfaces.

Do not introduce abstractions solely because they may be useful someday. Introduce them when the current implementation demonstrates a real need.

---

## Three.js and 3D

The 3D environment is an interface, not merely a visual background.

Keep scene logic separate from content and application state where practical.

Prefer:

- reusable scene systems
- semantic model metadata
- explicit interaction states
- predictable camera behavior
- optimized assets
- graceful degradation

Avoid embedding important content directly into model-specific scene code.

3D models should be optimized for web delivery.

Consider geometry complexity, texture size, draw calls, loading behavior, memory usage, and lower-powered mobile devices.

---

## Audio

Real recordings are preferred for user-facing musical examples.

Audio systems should be designed around a shared playback timeline where synchronization is required.

Avoid coordinating multiple independent media elements through approximate playback timing when sample-accurate or shared scheduling is necessary.

Keep audio state separate from UI state while providing a clear synchronization layer between them.

Audio interactions must not make core navigation inaccessible to users who cannot hear the content.

---

## Score and Musical Data

Treat musical notation as structured data where practical rather than as static imagery.

Score, audio, visualization, and interaction should be capable of sharing a common representation of musical time.

Do not assume users can read conventional notation.

Musical terminology and notation should be explainable through interaction, sound, and accessible text.

---

## Content

Content should be structured and data-driven.

Avoid embedding substantial instrument, technique, repertoire, or rights information directly inside UI components.

Content models should support relationships such as:

```text
instrument → technique → score event → repertoire excerpt → recording
```

and navigation in the reverse direction.

Do not invent factual musical information.

When content is uncertain, mark it for verification rather than presenting speculation as fact.

---

## Licensing and External Assets

Licensing is a first-class constraint.

Never assume an asset is reusable because it is publicly accessible or because the underlying composition is in the public domain.

Do not invent or infer missing licensing information.

External assets should retain provenance and rights metadata where applicable, including:

- source
- creator
- license
- license URL
- attribution requirements
- composition rights
- performance rights
- recording rights
- video rights
- model or image rights
- known restrictions
- verification status

If rights are ambiguous, mark the asset as requiring human review.

AI research may assist licensing investigation but must not make the final legal determination.

---

## Dependencies

Do not add a dependency without a concrete reason.

Before introducing one:

1. determine whether the existing stack already solves the problem;
2. consider browser/platform APIs where appropriate;
3. evaluate maintenance status and bundle/runtime impact;
4. explain why the dependency is justified.

Avoid installing large frameworks for small utilities.

Do not replace established project technology without explicit approval.

---

## Performance Engineering

Orchestra Atlas is a performance-sensitive audiovisual application. Rendering, animation, audio, and interface systems must be designed with CPU, GPU, memory, bandwidth, and mobile-device constraints in mind.

### Performance-aware implementation

When modifying Three.js, WebGL, GLSL, GSAP, SVG, Web Audio, or other performance-sensitive systems:

- Avoid unnecessary work in animation frames and rendering loops.
- Avoid repeated allocations and redundant calculations in hot paths.
- Reuse geometries, materials, textures, buffers, and other resources where appropriate.
- Manage the lifecycle of GPU resources, audio nodes, animation timelines, listeners, observers, and timers.
- Prevent duplicate animation loops and unnecessary background processing.
- Consider draw calls, fragment-shader complexity, transparency overdraw, and post-processing costs.
- Evaluate caching, lazy loading, asset compression, and code splitting where relevant.
- Avoid retaining resources that are no longer needed.
- Consider performance on lower-powered mobile devices and high-density displays.

Do not introduce optimizations that unnecessarily compromise visual quality, audio accuracy, accessibility, or maintainability.

### Media asset performance

Images, videos, audio recordings, 3D models, textures, and fonts are performance-sensitive resources, including when hosted externally on Cloudflare R2.

When introducing or modifying assets, consider transfer size, delivery caching, decoding cost, runtime memory, GPU memory, loading priority, and resource lifecycle.

Prefer appropriate formats, compression, lazy loading, reuse, and bounded caching while preserving visual and audio quality.

Do not assume that CDN delivery alone guarantees optimized assets.

Use the `orchestra-performance-auditor` skill for substantial asset-loading changes or dedicated media performance audits.

Do not alter production assets, storage configuration, or licensing metadata without appropriate approval.

### Performance review

For substantial changes to rendering, animation, audio, asset loading, or other performance-critical systems, use the `orchestra-performance-auditor` skill when available.

For smaller changes, perform a proportionate review of the modified code.

A review should consider:

1. CPU and GPU cost.
2. Memory allocation and resource cleanup.
3. Redundant rendering or calculations.
4. Asset and network efficiency.
5. Performance under realistic and demanding usage.
6. Potential regressions in existing behavior.

### Evidence-driven optimization

Distinguish between measured bottlenecks and suspected inefficiencies.

Do not claim a performance improvement without supporting measurements.

When profiling is unavailable, document the suspected issue and explain how it could be verified.

Prefer focused optimizations over broad refactoring.

Do not remove code, dependencies, or assets without checking whether they are still required.

### Adaptive quality

When expensive visual effects are necessary to preserve the experience, consider adaptive quality rather than removing them.

Potential approaches include:

- Reducing shader complexity for small or distant objects.
- Adjusting device pixel ratio.
- Simplifying effects on lower-powered devices.
- Suspending unnecessary offscreen work.
- Deferring noncritical assets.
- Reducing expensive post-processing.

Preserve the intended visual and interaction design across quality levels.

### Performance validation

For significant performance-sensitive changes, validate representative application states when the necessary tools are available.

Include demanding scenarios where relevant, such as multiple simultaneously animated or playing instruments.

Report any measurements performed, optimizations made, remaining risks, and limitations of the validation.

Do not silently expand a focused implementation task into a full performance audit.

---

## React, Vite, and Styling Performance

The project uses React and Vite, with CSS, Sass, or Tailwind CSS depending on the application.

Implementations should consider both runtime performance and production asset delivery.

### React

Keep high-frequency animation, audio analysis, and WebGL updates outside React's render cycle when they do not affect declarative UI.

- Do not update React state every animation frame solely to drive shader uniforms, Three.js objects, or audio parameters.
- Use refs or appropriately owned external systems for mutable values that do not require React rendering.
- Keep React responsible for application state, interaction state, accessibility, and declarative UI.
- Avoid unnecessary rerenders of expensive component trees.
- Use memoization selectively, based on actual rendering cost and stable dependencies.
- Avoid creating subscriptions, event listeners, timers, or animation loops during rendering.
- Ensure effects clean up their resources correctly, including under React Strict Mode development behavior.
- Avoid duplicating external state across React components.
- Use selectors or appropriately scoped subscriptions when components need only part of a frequently changing state.
- Consider lazy loading for large routes and expensive components.
- Do not introduce unnecessary global state or complex abstractions solely for performance.

Use React profiling tools when investigating rendering bottlenecks.

Do not assume that every rerender is a performance problem.

### Vite and production builds

Evaluate performance using production builds, not development-server behavior alone.

- Inspect production JavaScript and CSS output when bundle size matters.
- Avoid eagerly loading large libraries used only in specific routes or interactions.
- Use dynamic imports for genuinely noncritical features.
- Consider lazy loading 3D inspectors, large models, audio libraries, and specialized visualizations.
- Avoid unnecessary dependencies and duplicated packages.
- Verify that development-only utilities are excluded from production.
- Consider asset compression, caching, and appropriate preload or prefetch strategies.
- Avoid splitting code into excessively small chunks without a demonstrated benefit.
- Do not assume that a smaller JavaScript bundle always produces a faster experience.

Measure loading, parsing, execution, and interaction costs where possible.

### CSS and Sass

Prefer efficient styling that avoids unnecessary layout and paint work.

- Prefer transform and opacity for frequently animated visual properties when appropriate.
- Avoid repeatedly animating layout-affecting properties such as width, height, top, and left when a transform-based solution would preserve the intended behavior.
- Use expensive blur, backdrop-filter, shadow, and SVG filter effects selectively.
- Avoid unnecessary forced synchronous layouts caused by interleaved DOM reads and writes.
- Avoid broad selectors and unnecessarily complex styling structures.
- Inspect compiled CSS for duplicated rules and excessive output.
- Avoid deeply nested Sass structures that generate unnecessarily large selectors.
- Use CSS containment or content-visibility when suitable and after checking interaction and accessibility behavior.
- Use will-change sparingly; do not apply it permanently to large numbers of elements.

Do not replace a visually important effect with a cheaper alternative without evaluating the visual tradeoff.

### Tailwind CSS

When Tailwind is used:

- Ensure production class detection includes all relevant source files.
- Avoid constructing class names dynamically in ways the build system cannot detect.
- Prefer explicit mappings for runtime-dependent variants.
- Avoid unnecessary duplication of utility combinations.
- Inspect production CSS output when size becomes a concern.
- Use arbitrary values and custom utilities intentionally.
- Do not assume Tailwind is inherently faster or slower than authored CSS.

Choose styling approaches based on maintainability, rendering behavior, and measured output rather than framework preference.

### React and real-time systems

Three.js, GSAP, Web Audio, and other continuously updating systems should have clearly defined ownership and lifecycle boundaries.

- Prefer a shared animation clock where practical.
- Do not create independent requestAnimationFrame loops for every instrument or visual node.
- Keep continuously changing shader and audio values out of React state unless React rendering is genuinely required.
- Ensure scene objects, animation timelines, and audio resources are cleaned up when their owners are disposed.
- Prevent repeated component mounting from creating duplicate external resources.
- Avoid rebuilding Three.js scenes or audio graphs due to unrelated React rerenders.
- Keep application/domain state separate from renderer-specific mutable objects.
- Ensure visual updates remain synchronized with the shared playback timeline where required.

For significant changes to these systems, use the orchestra-performance-auditor skill when available.

### Validation

When relevant, assess:

- React commit frequency and rendering cost.
- Main-thread long tasks.
- Animation frame-time consistency.
- Production JavaScript and CSS bundle sizes.
- Unnecessary asset loading.
- Repeated mounting and cleanup behavior.
- Memory growth during navigation.
- Mobile responsiveness and rendering performance.

Distinguish measured problems from theoretical optimization opportunities.

---

## Code Quality

Prefer code that is:

- readable
- typed where appropriate
- testable
- modular without unnecessary abstraction
- explicit about state and side effects

Avoid premature generalization.

Comments should explain non-obvious reasoning, constraints, synchronization behavior, or unusual implementation decisions rather than restating the code.

---

## Validation

After implementing a meaningful change, run the relevant available checks.

Depending on the project state, these may include:

- type checking
- linting
- unit tests
- integration tests
- build
- accessibility checks

Do not claim a check passed unless it was actually run.

If a check cannot be run, state that clearly.

For visual or interaction work, automated tests do not replace human browser review.

---

## Browser verification guidelines

- Minimize browser launches during development.
- Reuse an existing automation browser session when supported.
- Avoid parallel browser verification tasks unless necessary.
- Close browser instances and pages created for verification when finished.
- Prefer targeted tests over full browser test suites for small changes.
- Do not leave headless Chrome processes running after verification.

---

## Agent Boundaries

Unless explicitly asked, an implementation agent should not:

- redefine product requirements
- substantially redesign an approved interaction
- make final licensing judgments
- fabricate content or sources
- expand the MVP
- introduce unrelated features
- perform broad refactors while implementing a focused task

When a task requires one of these decisions, surface it for human review.

---

## Completion Report

When completing a non-trivial task, briefly report:

1. what changed;
2. which important files changed;
3. what validation was performed;
4. any deviations from the specification;
5. unresolved questions, risks, or follow-up work.

Keep the report concise.

---

## Guiding Rule

When choosing between a technically impressive implementation and one that better serves the musical experience, prefer the musical experience.

When uncertain about product intent, consult `docs/vision.md` and ask rather than silently inventing a new direction.
