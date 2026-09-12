# Orchestra Atlas — Agent Workflow

## Purpose

Orchestra Atlas is developed through collaboration between a human designer/developer and AI agents.

The purpose of the agent workflow is not to maximize autonomy.

It is to use AI to accelerate research, design exploration, prototyping, implementation, validation, and review while keeping product direction and final judgment under human control.

The workflow should make AI contributions:

- focused
- reviewable
- reproducible
- grounded in project documentation
- easy to validate
- safe to revise or reject

The repository is the shared source of truth.

Important decisions should live in documentation, specifications, code, tests, or structured content rather than only in conversation history.

---

## Core Workflow

Orchestra Atlas is an interaction-heavy project. Many design decisions cannot be resolved convincingly in documentation alone.

The default workflow therefore includes explicit prototyping and experiential iteration:

```text
IDEA
  ↓
DESIGN / RESEARCH
  ↓
INITIAL FEATURE SPECIFICATION
  ↓
HUMAN APPROVAL OF DIRECTION
  ↓
PROTOTYPE
  ↕
EXPERIENCE REVIEW + ITERATION
  ↓
SPECIFICATION REFINEMENT
  ↓
HUMAN APPROVAL OF BEHAVIOR
  ↓
PRODUCTION IMPLEMENTATION
  ↓
VALIDATION
  ↓
INDEPENDENT REVIEW
  ↓
HUMAN FINAL REVIEW
  ↓
REVISION
  ↓
ACCEPTANCE
```

Not every change requires every stage.

The amount of process should be proportional to the risk, uncertainty, and complexity of the task.

For well-understood functionality, prototyping may be unnecessary.

For novel spatial, musical, visual, responsive, or interaction behavior, prototyping should be expected.

---

## Human Role

The human developer is the product owner and final decision maker.

The human is responsible for:

- product direction
- scope
- interaction intent
- visual judgment
- musical judgment
- prioritization
- accepting or rejecting agent proposals
- evaluating prototypes
- resolving ambiguous requirements
- final licensing decisions
- final review of user experience

Agents may recommend changes, identify problems, create experiments, and propose alternatives.

They should not silently redefine product decisions.

---

## Agent Roles

Roles describe responsibilities, not necessarily permanently running agents.

A role may be performed by:

- a dedicated Codex session
- a fresh context
- another suitable AI tool
- a specialized agent introduced later

Keeping roles conceptually separate is more important than implementing a complex multi-agent system.

---

### Product / Design Agent

Purpose:

Translate product ideas into explicit interaction concepts and specifications.

Responsibilities:

- read the project vision
- clarify user goals
- define user flows
- define interaction states
- describe transitions and motion intent
- consider desktop and mobile behavior
- consider accessibility
- identify edge cases
- identify assumptions that require prototyping
- define acceptance criteria

Expected output may include:

```text
Goal
User scenario
Interaction model
States
Transitions
Responsive behavior
Accessibility behavior
Known constraints
Prototype questions
Acceptance criteria
Open questions
```

The design agent should not implement production code unless explicitly asked.

The design agent should distinguish between:

- established requirements
- recommendations
- hypotheses
- questions requiring prototyping
- unresolved decisions

It should not turn suggestions into requirements without human approval.

---

### Research / Content Agent

Purpose:

Gather and structure information required by the experience.

Responsibilities may include:

- instrument research
- playing-technique research
- repertoire research
- orchestration research
- source discovery
- media discovery
- 3D asset discovery
- rights and licensing research
- attribution research
- metadata preparation

Research output should include sources and uncertainty.

The agent must distinguish between:

- verified information
- likely information
- unresolved information

It must never invent missing licensing information.

A research agent may identify that an asset appears usable under a particular license, but final rights approval remains a human responsibility.

Research should preferably produce structured data that can later enter the content system.

---

### Prototype Agent

Purpose:

Create experiments that answer design or technical questions.

Prototype work is exploratory.

Its primary goal is learning, not producing final architecture.

Examples include:

- testing the spatial arrangement of the illuminated orchestra
- comparing camera behaviors
- experimenting with luminous materials
- testing section-selection interactions
- exploring touch gestures
- evaluating mobile layouts
- testing score-following behavior
- experimenting with audio highlighting
- validating whether an interaction is technically feasible

The prototype agent should be told explicitly what questions the prototype is intended to answer.

Prototype priorities are:

1. speed of iteration
2. clarity of the experiment
3. ability to evaluate the experience
4. minimal unnecessary infrastructure

During prototyping, it may be acceptable to use:

- placeholder geometry
- placeholder content
- temporary data
- simplified state
- hardcoded experimental values
- temporary controls
- isolated routes or development views

Avoid premature architecture during prototype work.

Do not build generalized production systems unless they are necessary to answer the prototype question.

Prototype code should not automatically be considered production-ready.

---

### Implementation Agent

Purpose:

Turn approved behavior into production-quality implementation.

Responsibilities:

1. read `AGENTS.md`;
2. read the relevant project documentation;
3. read the approved feature specification;
4. inspect relevant prototypes and existing implementation;
5. identify dependencies and constraints;
6. propose an implementation plan for non-trivial work;
7. implement the smallest coherent production solution;
8. run relevant validation;
9. report what changed.

The implementation agent should not silently redesign the feature while implementing it.

If implementation reveals a problem with the specification, surface the issue rather than making a significant product decision implicitly.

Small technical decisions that do not change product behavior may be made autonomously.

Prototype code may be reused when appropriate, but should not be promoted to production merely because it works.

---

### Review Agent

Purpose:

Independently evaluate completed production work.

Whenever practical, review should happen in a fresh context rather than by the same context that performed the implementation.

The review agent should read:

- `AGENTS.md`
- relevant project documentation
- the approved feature specification
- the implementation diff
- relevant tests

The review agent should inspect rather than rewrite unless explicitly asked to fix issues.

Review findings should be classified as:

#### Blocker

The implementation should not be accepted.

Examples:

- core interaction does not satisfy the specification
- serious accessibility failure
- broken functionality
- data loss
- major performance issue
- unsafe licensing assumption

#### Important

The implementation works but should probably be corrected before the feature is considered complete.

Examples:

- significant responsive problem
- missing interaction state
- architectural coupling likely to cause problems
- inadequate error handling
- meaningful accessibility issue

#### Polish

A worthwhile improvement that does not prevent acceptance.

Examples:

- small motion inconsistency
- minor code cleanup
- subtle layout improvement
- non-critical edge case

Each finding should include:

- severity
- location
- problem
- why it matters
- recommended action

The review agent should also explicitly state when no significant issues were found.

---

## Feature Specifications

Significant interactions should have a specification.

Specifications live under:

```text
/specs
```

Possible examples:

```text
/specs/orchestra-installation.md
/specs/instrument-explorer.md
/specs/technique-explorer.md
/specs/repertoire-experience.md
/specs/interactive-score.md
/specs/audio-mixing.md
```

A specification describes a meaningful user-facing capability or system.

Do not create a separate specification for every small interaction or implementation detail.

For example, section hover, section selection, camera response, mobile behavior, and accessibility may all belong to `orchestra-installation.md`.

Implementation tasks can then address smaller slices of that specification.

---

## Specifications as Living Design Documents

Specifications are not immutable contracts.

They represent the best current understanding of the intended experience.

For creative interaction work, specifications may begin with unresolved questions.

A specification may distinguish between:

```text
Established
To Prototype
Open Questions
Approved Behavior
```

For example:

```markdown
## Section Selection

### Established

- Selecting a section must preserve the spatial context of the orchestra.
- Non-selected sections should remain perceivable.
- Selection must not depend on color alone.
- The interaction must work without hover.

### To Prototype

- Amount of spatial separation.
- Whether the camera should move.
- Light-intensity transition.
- Transition duration.
- Mobile presentation.

### Open Questions

- Should individual instruments become selectable immediately after
  selecting a section?
```

This is preferable to inventing precise behavior before it has been experienced.

---

## Prototype Loop

Prototype work follows a shorter iterative loop:

```text
QUESTION / HYPOTHESIS
        ↓
PROTOTYPE
        ↓
RUN IN BROWSER / DEVICE
        ↓
HUMAN EXPERIENCE REVIEW
        ↓
WHAT DID WE LEARN?
        ↓
REVISE
        ↺
```

Several iterations may happen before the design is ready for production.

For example:

```text
Prototype spatial layout
        ↓
Feels too flat
        ↓
Increase depth variation
        ↓
Test section selection
        ↓
Camera movement feels disorienting
        ↓
Move selected section instead
        ↓
Test on mobile
        ↓
Spatial movement communicates poorly
        ↓
Introduce mobile contextual panel
```

This is expected.

Iteration is not evidence that the first implementation failed.

The prototype exists to reveal behavior that could not be reliably predicted beforehand.

---

## Learning Capture

Important discoveries made during prototyping should not remain only in code or conversation.

After a meaningful prototype iteration, ask:

> What did this prototype teach us?

If the answer changes intended behavior, update the relevant specification.

For example, an initial specification may say:

```text
Selecting a section causes the camera to focus on it.
```

After prototyping, this may become:

```text
Selecting a section causes the selected group to move slightly
toward the viewer while other sections recede.

The camera makes only a minimal framing adjustment to preserve
spatial orientation.
```

The specification should capture the learned design decision.

Do not use prototype implementation details as a substitute for documenting intent.

---

## Prototype Code

Prototype code has a different standard from production code.

It may deliberately trade:

- abstraction
- extensibility
- completeness
- test coverage
- content integration

for faster learning.

However, prototype code should still be understandable enough to modify safely during experimentation.

Clearly identify prototype-only assumptions where they could otherwise be mistaken for production decisions.

Avoid building production architecture around accidental prototype structure.

---

## Prototype to Production

When prototype behavior is approved:

```text
PROTOTYPE
   ↓
CAPTURE LEARNINGS
   ↓
UPDATE SPEC
   ↓
APPROVE BEHAVIOR
   ↓
DECIDE WHAT PROTOTYPE CODE IS REUSABLE
   ↓
PRODUCTION IMPLEMENTATION
```

Before reusing prototype code, evaluate whether it satisfies production requirements for:

- architecture
- maintainability
- accessibility
- responsive behavior
- performance
- content integration
- error handling
- testing

It is acceptable to discard a successful prototype and rebuild the feature cleanly.

The value of a prototype is the knowledge it produces, not the amount of code that survives.

---

## Approval Boundaries

There are two useful approval points.

### Direction Approval

Occurs before substantial prototyping.

It answers:

> Is this concept worth exploring?

At this stage, unresolved interaction details are acceptable.

### Behavior Approval

Occurs after sufficient prototyping.

It answers:

> Is this the experience we intend to build properly?

After behavior approval, the specification becomes the reference for production implementation.

If production implementation requires a meaningful behavioral deviation, surface it for approval.

---

## Task Size

Agent tasks should have a clear completion boundary.

During prototyping, prefer tasks such as:

> Prototype three approaches to section selection using placeholder orchestra geometry. Focus on spatial movement and camera behavior. Do not productionize the scene architecture.

During production, prefer tasks such as:

> Implement the approved section-selection behavior defined in `specs/orchestra-installation.md`.

Avoid vague tasks such as:

> Build the orchestra experience.

A feature specification may produce many implementation tasks.

For example:

```text
specs/orchestra-installation.md
              ↓
3D orchestra layout
              ↓
section selection state
              ↓
camera / spatial transitions
              ↓
musical activity visualization
              ↓
mobile interaction
              ↓
accessible semantic representation
```

All tasks should refer back to the same approved feature behavior.

---

## Planning

For non-trivial production implementation tasks, the implementation agent should plan before editing.

A useful plan identifies:

- files or systems likely to change
- state changes
- data requirements
- dependencies
- testing strategy
- accessibility implications
- responsive implications
- performance implications where relevant

Plans should be concise.

Planning is intended to expose misunderstandings before implementation, not create documentation for its own sake.

Prototype tasks generally require less planning.

---

## Parallel Work

Parallel agents should only be used when responsibilities have clean boundaries.

Good candidates include:

```text
3D asset preparation
        +
instrument content research
        +
audio metadata preparation
```

or:

```text
Three.js scene prototype
        +
content research
        +
audio-engine experiment
```

provided that each task has a clear interface and does not require agents to edit the same implementation surface.

Avoid multiple agents simultaneously modifying:

- the same component
- the same state store
- the same scene controller
- the same content file
- tightly coupled architecture

Parallelism should reduce waiting, not create merge and coordination problems.

Start sequentially and introduce parallel work only when the project structure makes the boundaries obvious.

---

## Context Management

Agents should not rely on previous conversation history as the only source of project knowledge.

Durable knowledge belongs in the repository.

Use:

```text
docs/
```

for project-level knowledge and decisions.

Use:

```text
specs/
```

for feature behavior and design decisions.

Use:

```text
content/
```

for structured musical and media content.

Use code and tests for implementation behavior.

When a recurring decision or constraint exists only inside a chat, consider whether it should be promoted into project documentation.

Do not copy entire conversations into the repository.

Capture decisions and learnings, not transcripts.

---

## Documentation Hierarchy

Agents should generally interpret project context in this order:

```text
docs/vision.md
      ↓
AGENTS.md
      ↓
relevant project documentation
      ↓
relevant feature specification
      ↓
existing implementation / prototype
      ↓
current task
```

These sources serve different purposes rather than simply overriding one another.

If they appear to conflict, the agent should surface the conflict instead of guessing which intent is correct.

---

## Research Workflow

Research-heavy tasks should follow:

```text
QUESTION
   ↓
SOURCE DISCOVERY
   ↓
EVIDENCE COLLECTION
   ↓
STRUCTURED FINDINGS
   ↓
UNCERTAINTY / RIGHTS REVIEW
   ↓
HUMAN APPROVAL
   ↓
CONTENT INTEGRATION
```

Research agents should preserve provenance.

For factual content, store or report:

- source
- author or institution where relevant
- URL or identifier
- date accessed where useful
- confidence or verification status
- notes

For media assets, additionally record relevant rights information.

Research results should not enter published content automatically.

---

## Licensing Workflow

Media should move through explicit rights states.

For example:

```text
DISCOVERED
    ↓
RESEARCHED
    ↓
RIGHTS UNCERTAIN
    ↓
HUMAN REVIEW
    ↓
APPROVED
```

or:

```text
DISCOVERED
    ↓
RESEARCHED
    ↓
HUMAN REVIEW
    ↓
REJECTED
```

Only approved media should be treated as production-ready.

An AI agent must not promote an asset to approved status.

If license evidence is incomplete or contradictory, preserve that uncertainty.

---

## Validation

Production implementation is not complete when code has merely been written.

Relevant validation may include:

```text
typecheck
lint
unit tests
integration tests
build
accessibility checks
responsive checks
performance checks
```

Agents should run available automated validation appropriate to the change.

Agents must not claim to have performed validation they did not perform.

Some aspects require human review.

In particular:

- visual quality
- animation feel
- musical experience
- perceived audio synchronization
- touch interaction
- overall usability

should be inspected in the running application.

Prototype validation is different.

A prototype is successful when it provides useful evidence about the question it was designed to investigate.

---

## Human Experience Review

Human experience review is especially important for Orchestra Atlas.

After a prototype or production implementation, experience the feature as a user.

Questions may include:

- Is the interaction understandable without explanation?
- Does it feel intentional?
- Does motion communicate something useful?
- Does the music remain the focus?
- Does spatial movement preserve orientation?
- Does it work naturally with touch?
- Does the mobile layout feel designed rather than compressed?
- Is important information accessible without the 3D scene?
- Does the feature encourage exploration?
- Does it still reflect the project vision?
- What surprised us when actually using it?

Subjective findings are legitimate design evidence.

Automated evaluation cannot replace design judgment.

---

## Revision

Review findings should become focused follow-up tasks.

For example:

```text
Observation:
Camera movement during section selection feels disorienting.

Prototype task:
Keep the camera mostly stationary and instead move the selected
section slightly toward the viewer. Compare the result with the
current interaction.
```

Or, during production:

```text
Review finding:
Mobile section selection obscures playback controls.

Follow-up task:
Adjust the mobile orchestra layout so section selection and playback
controls can coexist without overlap. Preserve existing desktop
behavior.
```

Avoid asking an agent to broadly "improve" a feature unless open-ended exploration is intentional.

---

## Git and Change Management

Agent work should remain easy to inspect.

Prefer:

- focused diffs
- meaningful commits
- descriptive commit messages
- one conceptual change per commit where practical

Avoid combining:

```text
feature implementation
+ dependency upgrades
+ unrelated refactoring
+ repository-wide formatting
```

in one change.

Prototype work may use temporary branches or focused experimental commits where useful.

Do not allow exploratory changes to become indistinguishable from approved production behavior.

Agents should not rewrite history, force-push, delete branches, or perform destructive Git operations unless explicitly instructed.

Human review should remain possible before significant changes are merged.

---

## Escalation

An agent should stop and ask for human direction when:

- requirements materially conflict
- a significant product decision is missing
- a requested implementation would undermine accessibility
- rights or licensing are ambiguous
- a destructive operation appears necessary
- a major dependency or architectural change is required
- implementation would significantly exceed the agreed scope
- available evidence is insufficient to make a reliable decision

During prototyping, uncertainty is not necessarily a reason to stop.

If uncertainty is exactly what the prototype is intended to explore, make the uncertainty explicit and design the experiment around it.

Agents should not escalate every minor implementation choice.

Use judgment.

---

## Evolving the Workflow

This workflow is intentionally simple.

The project should not introduce multi-agent orchestration infrastructure until repeated work demonstrates a concrete need.

Possible future improvements may include:

- specialized agent instructions for different directories
- automated review agents
- content validation pipelines
- asset-processing agents
- MusicXML analysis tools
- automated accessibility checks
- structured licensing validation
- parallel research workflows
- CI-based agent validation

These should be introduced because they solve observed problems, not because agent infrastructure is interesting by itself.

Orchestra Atlas is the product.

The agent system exists to help build it.

---

## Initial Working Loop

During the early phase of the project, use this default loop:

```text
1. Discuss an idea
        ↓
2. Write an initial feature specification
        ↓
3. Identify established behavior and questions to prototype
        ↓
4. Human approves the direction
        ↓
5. Build a focused prototype
        ↓
6. Human experiences it in the browser / device
        ↓
7. Iterate until the important questions are resolved
        ↓
8. Capture learnings in the feature specification
        ↓
9. Human approves the resulting behavior
        ↓
10. Codex plans the production implementation
        ↓
11. Codex implements it
        ↓
12. Automated validation runs
        ↓
13. A fresh agent context reviews the implementation
        ↓
14. Human performs final experience review
        ↓
15. Findings become focused revision tasks
        ↓
16. Accept and commit the feature
```

For features with little design uncertainty, steps 5–7 may be skipped.

Do not add more agent complexity until this loop itself becomes a bottleneck.

---

## Guiding Principles

Agentic development does not mean giving AI unlimited autonomy.

It means giving agents:

- clear responsibilities
- sufficient context
- explicit boundaries
- durable project knowledge
- opportunities to experiment
- verifiable outputs
- independent review

while keeping product intent and final judgment under human control.

For creative interaction work:

> Prototype to learn. Document what was learned. Productionize what has been proven.

The prototype is allowed to be temporary.

The knowledge it produces should not be.