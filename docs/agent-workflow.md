# Orchestra Atlas — Agent Workflow

## Purpose

Orchestra Atlas is developed through collaboration between a human designer/developer and AI agents.

The purpose of the agent workflow is not to maximize autonomy.

It is to use AI to accelerate research, design exploration, implementation, validation, and review while keeping product direction and final judgment under human control.

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

For significant features, the default workflow is:

```text
IDEA
  ↓
DESIGN / RESEARCH
  ↓
FEATURE SPECIFICATION
  ↓
HUMAN APPROVAL
  ↓
IMPLEMENTATION PLAN
  ↓
IMPLEMENTATION
  ↓
VALIDATION
  ↓
INDEPENDENT REVIEW
  ↓
HUMAN EXPERIENCE REVIEW
  ↓
REVISION
  ↓
ACCEPTANCE
```

Not every small change requires every stage.

The amount of process should be proportional to the risk and complexity of the task.

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
- resolving ambiguous requirements
- final licensing decisions
- final review of user experience

Agents may recommend changes, identify problems, and propose alternatives.

They should not silently redefine these decisions.

---

## Agent Roles

Roles describe responsibilities, not necessarily permanently running agents.

A role may be performed by:

- a dedicated Codex session
- a fresh context
- another suitable AI tool
- a specialized agent introduced later

Keeping roles conceptually separate is more important than implementing a complex multi-agent system.

### Product / Design Agent

Purpose:

Translate product ideas into explicit interaction specifications.

Responsibilities:

- read the project vision
- clarify user goals
- define user flows
- define interaction states
- describe transitions and motion intent
- consider desktop and mobile behavior
- consider accessibility
- identify edge cases
- define acceptance criteria

Expected output:

```text
Goal
User scenario
Interaction model
States
Transitions
Responsive behavior
Accessibility behavior
Edge cases
Acceptance criteria
Open questions
```

The design agent should not implement production code unless explicitly asked.

The design agent should distinguish between:

- requirements
- recommendations
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

### Implementation Agent

Purpose:

Implement an approved specification.

Responsibilities:

1. read `AGENTS.md`;
2. read the relevant project documentation;
3. read the approved feature specification;
4. inspect the existing implementation;
5. identify dependencies and constraints;
6. propose an implementation plan for non-trivial work;
7. implement the smallest coherent solution;
8. run relevant validation;
9. report what changed.

The implementation agent should not silently redesign the feature while implementing it.

If implementation reveals a problem with the specification, stop or surface the issue rather than making a significant product decision implicitly.

Small technical decisions that do not change product behavior may be made autonomously.

---

### Review Agent

Purpose:

Independently evaluate completed work.

Whenever practical, review should happen in a fresh context rather than by the same context that performed the implementation.

The review agent should read:

- `AGENTS.md`
- relevant project documentation
- the feature specification
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

Significant interactions should have a specification before implementation.

Specifications live under:

```text
/specs
```

Possible examples:

```text
/specs/orchestra-installation.md
/specs/instrument-inspector.md
/specs/technique-viewer.md
/specs/interactive-score.md
/specs/audio-highlighting.md
```

Specifications should describe observable behavior rather than prescribe implementation unnecessarily.

A useful feature specification usually contains:

```text
# Feature Name

## Goal

## User Experience

## Interaction States

## Transitions

## Responsive Behavior

## Accessibility

## Data Requirements

## Technical Constraints

## Edge Cases

## Acceptance Criteria

## Open Questions
```

Technical implementation details should be included when they are genuine constraints, not simply because one implementation happens to be obvious.

---

## Approval Boundary

A specification becomes implementation-ready only after human approval.

Before approval, agents may:

- explore
- critique
- research
- propose alternatives
- identify technical constraints

After approval, the implementation agent should treat the specification as the intended behavior.

If the implementation requires a meaningful deviation, that deviation should be surfaced for approval.

This creates a clear boundary between:

```text
What should we build?
```

and:

```text
How should we build it?
```

---

## Task Size

Agent tasks should have a clear completion boundary.

Prefer tasks such as:

> Implement section selection for the orchestra installation according to `specs/orchestra-installation.md`.

over:

> Build the orchestra experience.

Prefer:

> Add synchronized gain transitions for Full, Highlight, and Solo modes according to `specs/audio-highlighting.md`.

over:

> Implement the audio system.

Large features should be decomposed into independently reviewable vertical slices.

Avoid decomposing work into extremely small tasks when doing so creates unnecessary coordination overhead.

The goal is coherent, reviewable units of work.

---

## Planning

For non-trivial implementation tasks, the implementation agent should plan before editing.

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
Three.js scene implementation
        +
content schema preparation
        +
audio-engine prototype
```

provided that each task has a clear interface and does not require agents to edit the same implementation surface.

Avoid multiple agents simultaneously modifying:

- the same React component
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

for approved feature behavior.

Use:

```text
content/
```

for structured musical and media content.

Use code and tests for implementation behavior.

When a recurring decision or constraint exists only inside a chat, consider whether it should be promoted into project documentation.

Do not copy entire conversations into the repository.

Capture decisions, not transcripts.

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
approved feature specification
      ↓
existing implementation
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

Implementation is not complete when code has merely been written.

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

---

## Human Experience Review

After implementation and automated validation, the human developer should experience the feature as a user.

Questions may include:

- Is the interaction understandable without explanation?
- Does it feel intentional?
- Does motion communicate something useful?
- Does the music remain the focus?
- Does it work naturally with touch?
- Does the mobile layout feel designed rather than compressed?
- Is important information accessible without the 3D scene?
- Does the feature encourage exploration?
- Does the implementation still reflect the original specification?

This stage is intentionally subjective.

Automated evaluation cannot replace design judgment.

---

## Revision

Review findings should become focused follow-up tasks.

For example:

```text
Review finding:
Mobile section selection obscures playback controls.

Follow-up task:
Adjust the mobile orchestra layout so section selection and playback
controls can coexist without overlap. Preserve the existing desktop
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
+ formatting the repository
```

in one change.

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
2. Turn it into a written specification
        ↓
3. Human reviews and approves the specification
        ↓
4. Codex plans the implementation
        ↓
5. Codex implements it
        ↓
6. Automated validation runs
        ↓
7. A fresh agent context reviews the implementation
        ↓
8. Human inspects the experience in the browser
        ↓
9. Findings become focused revision tasks
        ↓
10. Accept and commit the feature
```

Do not add more agent complexity until this loop becomes a bottleneck.

---

## Guiding Principle

Agentic development does not mean giving AI unlimited autonomy.

It means giving agents:

- clear responsibilities
- sufficient context
- explicit boundaries
- durable project knowledge
- verifiable outputs
- independent review

while keeping product intent and final judgment under human control.