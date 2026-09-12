# Orchestra Atlas — Agent Instructions

Orchestra Atlas is an interactive web experience for exploring the symphonic orchestra through 3D, sound, motion, notation, and real musical performances.

This repository is developed collaboratively by a human designer/developer and AI coding agents.

## Source of Truth

Before making significant product, design, or architectural decisions, read:

- `docs/vision.md`

The vision document defines the purpose, audience, experience principles, scope, and design direction of the project.

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