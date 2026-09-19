# Orchestra Installation — Design & Prototype Specification

**Status:** Historical Prototype 01A record  
**Current production contract:** [specs/orchestra-map.md](../../specs/orchestra-map.md)

This file is the design record for the first geometry and camera experiments. Seating, polar lattice, and framing decisions that survived are summarized in [COMPOSITION-REFINEMENT.md](COMPOSITION-REFINEMENT.md). Do not implement new map behavior from this document; use the production specification.

**Original status:** Exploratory  
**Original iteration:** Prototype 01A — Geometry + Camera  
**Implementation target:** Orchestra Atlas  
**Document type:** Living specification (superseded for production behavior)


---

## 1. Purpose of this document

This is the living design and implementation specification for the Orchestra Installation.

The feature will be developed iteratively through focused prototypes. Each prototype should answer a small number of design questions before additional behavior or visual complexity is introduced.

This document distinguishes between:

1. **Established decisions** — decisions that subsequent prototypes should preserve unless explicitly reconsidered.
2. **Current experiment** — the behavior or visual concept that should be implemented now.
3. **Open questions** — unresolved design questions that must not be silently decided during implementation.

Do not treat temporary prototype choices as production requirements.

After each prototype is reviewed, findings should be recorded here. Successful decisions can then be promoted into established decisions before the next prototype begins.

---

# 2. Product context

Orchestra Atlas is an interactive cultural and educational web experience organized around the conceptual journey:

```text
orchestra
    ↓
section
    ↓
instrument
    ↓
technique
    ↓
repertoire
```

The experience should connect physical instruments, sound production, notation, orchestral context, recordings, and performance.

The product is intended for curious newcomers as well as musicians. It should not assume that the user already understands orchestral terminology, seating, notation, or classical music conventions.

The distinctive value of Orchestra Atlas is not encyclopedic breadth.

It should use sound, space, motion, 3D objects, notation, and real performances as a connected exploratory system.

A useful product-level test is:

> Does this interaction help someone understand, hear, or experience the orchestra in a way that static media alone cannot?

---

# 3. What the Orchestra Installation is

The Orchestra Installation is the primary spatial representation of the orchestra within Orchestra Atlas.

It is a contemporary digital light installation composed of abstract luminous objects arranged according to orchestral seating.

Each object represents an individual player or instrumental position.

Collectively, these objects form a spatial sculpture that should remain recognizable as an orchestra without requiring literal musicians, chairs, or a simulated concert hall.

The Installation will eventually serve several purposes:

- main orchestra map;
- section-level navigation;
- bridge into individual instrument exploration;
- visualization of musical activity;
- playback feedback;
- spatial representation of orchestration;
- major component of the visual identity of Orchestra Atlas.

The Installation is therefore not intended to become a decorative 3D background underneath conventional UI.

Eventually, the spatial scene itself should function as an interface.

Prototype 01A intentionally does not implement that interaction yet.

---

# 4. Experience principles

The Installation should eventually feel like:

> A restrained, tactile contemporary digital artwork that is also legible as an orchestra.

The visual language should favor:

- meaningful spatial composition;
- orchestral seating as structure;
- strong negative space;
- depth;
- light;
- translucency;
- subtle reflection;
- restrained expressive color;
- deliberate motion;
- contemporary cultural-institution sensibility;
- editorial clarity.

Avoid:

- literal concert-hall simulation;
- literal musicians;
- literal chairs as the primary representation;
- generic particle effects;
- generic audio visualizer aesthetics;
- neon cyberpunk treatment;
- game-like HUDs;
- dashboard layouts;
- excessive gradients;
- unnecessary visual noise;
- decorative animation without semantic purpose.

Motion, when introduced in later prototypes, should communicate something such as:

- musical activity;
- hierarchy;
- navigation;
- selection;
- state.

It should not exist merely to make the scene look active.

---

# 5. Established decisions

At the start of Prototype 01A, only the following should be treated as established.

### 5.1 Spatial representation

The orchestra will be represented as a collection of abstract player-position objects in 3D space.

Each object corresponds conceptually to one player or instrumental position.

### 5.2 Seating matters

Player positions should follow recognizable symphonic-orchestra seating logic.

The default spatial model should use a contemporary orchestral arrangement as its neutral baseline:

- strings form the broad foreground around the conductor;
- woodwinds occupy the compact center behind the strings;
- brass sit behind the woodwinds;
- percussion occupies the rear;
- double basses sit behind or toward the outer edge of the lower strings;
- horns are part of the brass family, even if their physical placement is later treated somewhat independently.

The exact production seating configuration is **not yet established**.

Different orchestras and conductors use different string arrangements. The implementation should therefore preserve the ability to change the seating model later rather than encoding one arrangement as universally correct.

The current prototype should use a common contemporary / “American” string arrangement as its starting reference because it provides a clear and recognizable baseline:

```text
audience view, left → right

1st Violins
2nd Violins
Violas
Cellos

Double Basses behind / outside the lower strings
```

This is a prototype baseline, not a claim that this is the only valid orchestral arrangement.

---

### 5.3 Abstraction

The primary representation should not rely on literal musicians or instruments.

### 5.4 Spatial interface

The 3D Installation is intended eventually to become an interface rather than a decorative illustration.

### 5.5 Iterative development

Visual and interaction behavior should be resolved through focused prototypes before being promoted into production requirements.

---

# 6. Prototype sequence

The current anticipated sequence is:

```text
Prototype 01A
Geometry + Camera

        ↓

Prototype 01B
Player Object + Material

        ↓

Prototype 01C
Section Differentiation

        ↓

Prototype 01D
Environment + Light + Depth

        ↓

Prototype 01E
Responsive Spatial Composition

        ↓

Prototype 02
Section Interaction

        ↓

later prototypes
Instrument interaction
Playback
Musical activity
Accessibility integration
Production behavior
```

This sequence is provisional.

Do not implement later prototypes simply because they appear here.

Only the iteration explicitly marked **Current** should be implemented.

---

# 7. Current experiment

## Prototype 01A — Geometry + Camera

**Status:** Current

### 7.1 Goal

Build the simplest useful spatial prototype of the Orchestra Installation.

The prototype should answer whether abstract player-position geometry arranged according to orchestral seating can:

1. read clearly as an orchestra;
2. create a compelling spatial silhouette;
3. communicate front/middle/rear organization;
4. feel like an object occupying space rather than a flat diagram;
5. provide enough depth and negative space for later light-installation treatment.

This iteration is specifically about:

> **geometry + spatial composition + camera**

It is not about final visual appearance.

---

# 8. Prototype 01A scene

Create a simple 3D scene using the project's existing frontend and 3D architecture where possible.

The scene should contain:

- a dark neutral background;
- one temporary primitive for every represented player position;
- recognizable orchestral sectional grouping;
- meaningful front-to-back depth;
- a perspective camera;
- minimal neutral lighting sufficient to perceive geometry.

The result should deliberately remain visually simple.

Do not introduce visual polish whose purpose belongs to later experiments.

---

# 9. Temporary player-position object

Use a simple placeholder primitive to represent each player position.

Preferred starting point:

```text
short vertical rounded cylinder / pillar
```

Other similarly simple primitives are acceptable if they fit the existing 3D stack better.

The primitive should:

- have visible volume;
- make spacing easy to judge;
- remain readable from the default camera;
- be inexpensive to render;
- be easy to replace later.

The primitive is temporary.

Its form must **not** be treated as an approved design for the final luminous player object.

Do not spend significant time refining its material.

---

# 10. Orchestra geometry
The composition should follow recognizable symphonic-orchestra seating logic.
The broad front-to-back hierarchy is:
                         REAR

                     PERCUSSION

                        BRASS

                      WOODWINDS

                STRINGS IN NESTED ARCS

                       CONDUCTOR

                         FRONT
The orchestra should read as a single ensemble organized around a shared spatial center.
Avoid representing the primary instrument families as unrelated rectangular blocks.
The conductor position should function as the geometric origin of the orchestral seating, regardless of whether a conductor object is rendered.
## 10.1 Spatial origin
Define a logical conductorOrigin.
This point is the geometric reference for:
- string arcs;
- orchestra center;
- front/back depth;
- angular section placement.
Example conceptual representation:
const conductorOrigin = {
  x: 0,
  y: 0,
  z: 0,
}
The exact coordinate system may follow the existing repository conventions.
The conductor origin is a spatial construction tool.
It does not imply that Prototype 01A must render a conductor object.
## 10.2 Strings
Strings should create the dominant foreground mass of the orchestra.
Do not model the strings as two disconnected rectangular groups.
Instead, arrange them in nested arcs centered approximately on the conductor origin.
The underlying seating data should distinguish at least:
violin1
violin2
viola
cello
doubleBass
These subdivisions may use the same temporary material in Prototype 01A.
The distinction exists so that geometry can become more musically credible and later instrument-level work does not require restructuring the seating model.
Default string ordering
For Prototype 01A, use the following audience-view baseline:
left                                      right

1st Violins → 2nd Violins → Violas → Cellos
                                      ↘
                                   Double Basses
This should be interpreted spatially rather than as four straight columns.
Each subsection should occupy an angular region within the larger string arc.
Strings may span multiple nested rows.
The section boundaries should remain somewhat perceptible through geometry, but the overall result should feel like one continuous foreground ensemble.
## 10.3 Woodwinds
Woodwinds should occupy a compact central area immediately behind the strings.
The woodwind section should be substantially narrower than the full string span.
Prefer a small number of short rows rather than a broad rectangular field.
The exact internal arrangement is not yet a production requirement, but the data model may distinguish:
flute
oboe
clarinet
bassoon
and later auxiliary instruments where relevant.
For Prototype 01A, the main concern is the visual footprint:
- compact;
- central;
- clearly behind the strings;
- clearly in front of the brass.
## 10.4 Brass
Brass should sit behind the woodwinds.
The section may be broader than the woodwind core but should not read as a completely separate side block.
At minimum, the data model should allow distinction between:
horn
trumpet
trombone
tuba
Horns belong semantically to Brass.
Their eventual placement may be offset compared with the other brass instruments, but Prototype 01A should keep them spatially related to the brass section rather than treating HORNS as a top-level orchestra family.
## 10.5 Percussion
Percussion should occupy the rear of the composition.
A broader rear band is acceptable and may help create the overall orchestral silhouette.
Exact instrument placement is not yet required.
Timpani and additional percussion positions may be represented as generic percussion player positions for this prototype.
## 10.6 Harp and keyboard positions
Harp, keyboard, piano, celesta, and similar special positions vary considerably by repertoire.
They should not determine the core geometry of Prototype 01A.
If included for visual comparison, treat them as optional / auxiliary positions.
Do not create a large permanent KEYBOARD family block simply to fill the composition.
Their final taxonomy and placement should be resolved later from repertoire and product requirements.

---


# 11. Player counts and seating data
Do not treat precise player counts as established product requirements in Prototype 01A.
Use a plausible full symphonic ensemble sufficient to evaluate:
- density;
- silhouette;
- section hierarchy;
- front/back depth;
- arc behavior;
- negative space.
The seating data should distinguish between family, instrument/subsection, and position.
A conceptual representation might resemble:
type OrchestraFamily =
  | 'strings'
  | 'woodwinds'
  | 'brass'
  | 'percussion'
  | 'auxiliary'

type OrchestraInstrument =
  | 'violin1'
  | 'violin2'
  | 'viola'
  | 'cello'
  | 'doubleBass'
  | 'flute'
  | 'oboe'
  | 'clarinet'
  | 'bassoon'
  | 'horn'
  | 'trumpet'
  | 'trombone'
  | 'tuba'
  | 'percussion'

type OrchestraPosition = {
  id: string
  family: OrchestraFamily
  instrument: OrchestraInstrument
  position: [number, number, number]
}
This API is illustrative rather than mandatory.
Follow repository conventions where appropriate.
The important requirement is that seating geometry is data-driven and easy to modify.

---


# 12. Geometry model
Prototype 01A should use a hybrid radial / row-based seating model.
Do not generate the whole orchestra from rectangular section bounds.
Use:
Strings       → radial / arc-based
Woodwinds     → compact row-based
Brass         → compact row-based, optionally shallow arcs
Percussion    → rear row / shallow arc
The orchestra should feel organized around the conductor origin.
## 12.1 String arc model
String player positions should be generated primarily from:
radius
angle
row
angular range
player spacing
A conceptual helper might look like:
generateArcPositions({
  center,
  innerRadius,
  rowCount,
  rowSpacing,
  startAngle,
  endAngle,
  count,
})
The exact implementation is flexible.
The important visual result is:
- nested arcs;
- continuous orchestral foreground;
- visible but not exaggerated subsection groupings;
- increasing radius away from the conductor.
## 12.2 Section gaps
Section identity should not depend on large empty rectangles between families.
Prefer restrained changes in:
- angular spacing;
- row spacing;
- local density;
- depth.
Small gaps may help identify subsection boundaries.
Large voids should be used only where they improve the Installation composition without breaking the sense of a single orchestra.

---


# 13. Geometry configuration and seating presets
Spatial constants should remain centralized.
In addition to the existing configuration values, make the radial geometry easy to tune.
A conceptual configuration could include:
type OrchestraSceneConfig = {
  orchestraScale: number

  conductorOrigin: [number, number, number]

  playerSpacing: number
  sectionSpacing: number

  strings: {
    innerRadius: number
    rowCount: number
    rowSpacing: number
    totalAngularSpan: number
    subsectionGap: number
  }

  woodwinds: {
    width: number
    rowDepth: number
    rowSpacing: number
  }

  brass: {
    width: number
    rowDepth: number
    rowSpacing: number
  }

  percussion: {
    width: number
    rowDepth: number
  }

  playerObject: {
    radius: number
    height: number
  }

  camera: {
    position: [number, number, number]
    target: [number, number, number]
    fov: number
  }
}
This exact structure is not required.
The goal is that the seating can be meaningfully reshaped without rewriting the scene.
## 13.1 Seating presets
Keep the three initial geometry presets:
compact
classical-wide
installation-spread
The presets should now manipulate the radial seating system rather than scale rectangular blocks.
Compact
Explore:
- smaller string radii;
- narrower angular span;
- reduced row spacing;
- tighter winds/brass/percussion spacing;
- minimal family separation.
Questions:
- Does greater density improve orchestral recognition?
- At what point does the Installation become visually congested?
Classical-wide
Use this as the default baseline for Prototype 01A.
It should aim for the strongest immediate resemblance to a conventional symphonic orchestra.
Explore:
- broad continuous string arcs;
- compact central woodwinds;
- brass grouped behind the winds;
- percussion forming the rear edge;
- moderate spacing between families.
Questions:
- Does this immediately read as an orchestra?
- Does it become too much like a literal seating chart?
Installation-spread
Preserve the same orchestral topology while introducing more negative space.
Explore:
- larger string radii;
- slightly wider subsection gaps;
- greater front/back separation;
- more deliberate family spacing;
- stronger overall silhouette.
Questions:
- Can the composition become more sculptural without losing orchestral recognition?
- How much separation can be introduced before the ensemble stops feeling cohesive?

---


# 14. Camera
The initial camera should use an elevated frontal audience perspective.
The conductor origin should sit close to the visual centerline of the orchestra.
The camera should reveal the nested string arcs clearly enough that the overall arrangement is immediately understandable.
The camera should be:
- centered broadly on the conductor/orchestra axis;
- positioned in front of the ensemble;
- elevated enough to reveal sectional organization;
- low enough to preserve object depth and physical presence;
- perspective-based rather than orthographic.
The string foreground should establish the widest part of the composition.
Woodwinds, brass, and percussion should visually step backward toward the rear.
Avoid:
- near-top-down seating-chart views;
- angles so low that woodwinds and brass disappear behind strings;
- extremely wide perspective distortion;
- framing that isolates families into unrelated zones.

---


# 15. Camera configuration
Make the following easy to tune:
camera position
camera height
camera distance
camera target
field of view
orchestra scale
The default camera target should relate to the geometric orchestra center rather than targeting an arbitrary individual section.
There should be one default composition.
Development-only orbit controls remain acceptable.

---


# 16. Environment

Keep the environment deliberately minimal.

For Prototype 01A:

- use a dark neutral background;
- use enough neutral light to understand volume;
- avoid dramatic lighting;
- avoid final materials;
- avoid atmospheric effects unless technically required;
- avoid visual elements that distract from geometry.

A simple ground plane may be used if it materially helps depth perception.

It should remain visually neutral.

Final floor treatment and reflections belong to a later prototype.

---

# 17. Debug tools

Provide a lightweight development/debug mode.

Useful optional aids include:

- ground grid;
- section bounds;
- section origins;
- player-position markers;
- camera target;
- camera helper;
- axes;
- section names for debugging.

These aids exist only to help evaluate and modify spatial composition.

They should be disabled in the normal prototype view.

Do not spend significant effort polishing debug tooling.

---

# 18. Interaction

There is no product interaction in Prototype 01A.

Player objects should not need to respond to:

- hover;
- click;
- tap;
- focus;
- keyboard selection.

Sections should not yet be selectable.

Instruments should not yet be selectable.

The camera should not respond to product interaction.

Development-only camera inspection is acceptable.

---

# 19. Animation

Do not introduce authored animation in Prototype 01A.

Specifically, do not add:

- idle movement;
- pulsing;
- floating;
- shimmering;
- musical animation;
- entrance animation;
- section transitions;
- camera transitions.

A static scene is intentional.

We first need to determine whether the spatial composition works without animation masking weaknesses in the geometry.

---

# 20. Color and materials

Do not attempt to establish the final visual language in Prototype 01A.

Use neutral materials that make geometry readable.

Do not establish:

- section color assignments;
- final luminous colors;
- translucency;
- emissive language;
- bloom;
- glow;
- glass treatment;
- reflective materials.

These belong to subsequent experiments.

If temporary colors are useful in **debug mode** to distinguish sections while editing geometry, that is acceptable.

Those colors should not appear in the normal prototype view and should not be interpreted as design decisions.

---

# 21. Labels and typography

Do not implement production section labels yet.

The design reference includes section labels, but their:

- placement;
- scale;
- typography;
- relationship to the scene;
- interaction behavior

remain open questions.

Debug labels are acceptable behind development mode.

---

# 22. Conductor
The conductor should be treated separately as:
1. a geometric origin, and
2. a possible future rendered object.
Geometric role
The conductor position is part of Prototype 01A.
Use it as the primary spatial origin around which the strings and overall seating geometry are organized.
Visual role
Whether the final Installation visibly represents the conductor remains unresolved.
Prototype 01A may show the conductor origin in debug mode.
Do not render a production conductor object unless explicitly required in a later prototype.

---


# 23. Responsive behavior

Production responsive behavior is not part of Prototype 01A.

However, avoid architecture that unnecessarily assumes a single fixed viewport size.

The scene should render without breaking when its container changes size.

Basic technical resizing of:

- renderer;
- camera aspect ratio;
- canvas

should work correctly.

Do not yet design different mobile/tablet compositions.

Responsive spatial composition will be explored explicitly in a later prototype.

---

# 24. Accessibility

The final Installation cannot depend solely on WebGL, spatial understanding, color, animation, hover, or precise pointing.

A semantic representation of the same orchestra will eventually need to drive and reflect the same selection state as the 3D scene.

That production accessibility layer is not part of Prototype 01A because this iteration has no product interaction.

However:

- do not make architectural decisions that intentionally prevent later semantic integration;
- do not treat the WebGL object hierarchy as the eventual accessibility model;
- do not assume accessibility will be solved by adding labels to the canvas later.

Accessibility will be designed alongside interaction once selection behavior is introduced.

---

# 25. Performance

Prototype 01A should use sensible rendering practices.

The scene represents an orchestra-sized number of repeated objects, so avoid obviously wasteful rendering architecture.

However, do not prematurely optimize at the expense of iteration speed.

The priority is:

```text
easy experimentation
        ↓
clear architecture
        ↓
reasonable performance
        ↓
production optimization later
```

If instancing materially simplifies or improves repeated player rendering without making experimentation harder, it may be used.

It is not mandatory for this prototype.

---

# 26. Architecture

This is exploratory code, but it should not be disposable code.

Structure the implementation so later prototypes can replace or extend:

```text
player geometry
player material
seating configuration
section representation
camera configuration
environment
lighting
```

without requiring the entire scene to be rewritten.

Prefer clear boundaries between:

```text
orchestra data / seating
        ↓
scene configuration
        ↓
3D representation
```

Avoid premature abstraction beyond what supports experimentation.

Do not build speculative architecture for playback, musical analysis, navigation, or interaction that Prototype 01A does not require.

---

# 27. Explicitly out of scope

Do **not** implement the following as part of Prototype 01A:

- hover states;
- click behavior;
- touch behavior;
- section selection;
- instrument selection;
- production section labels;
- production typography;
- section colors;
- final player-object design;
- glow;
- bloom;
- translucency;
- final materials;
- final lighting;
- reflections;
- music playback;
- audio controls;
- score data;
- music-driven animation;
- volume-driven animation;
- idle animation;
- section animation;
- camera animation;
- product camera controls;
- contextual panels;
- instrument detail UI;
- onboarding;
- tutorials;
- production navigation;
- production accessibility UI;
- production mobile composition.

Do not implement these preemptively.

---

# 28. Acceptance criteria
Prototype 01A is complete when all of the following are true.
Rendering
- A 3D orchestra-shaped arrangement renders successfully.
- Each represented player position is visible as a simple abstract object.
- The scene renders correctly within the existing application.
Spatial organization
- The arrangement is organized around a clear conductor origin.
- Strings form the dominant foreground using nested arcs rather than rectangular blocks.
- First violins, second violins, violas, cellos, and double basses exist as separate seating-data groups.
- These string groups visually combine into one coherent foreground ensemble.
- Woodwinds form a compact central grouping behind the strings.
- Brass form a group behind the woodwinds.
- Horns are represented as part of the brass taxonomy.
- Percussion occupies the rear region.
- Auxiliary positions do not dominate the primary orchestral silhouette.
- The overall composition has meaningful width and depth.
Configuration
- Important radial string parameters can be changed centrally.
- Front/back family spacing can be changed centrally.
- Camera parameters can be changed centrally.
- Player placeholder dimensions can be changed centrally.
Presets
The developer can easily compare:
compact
classical-wide
installation-spread
without rewriting the scene.
classical-wide should be the initial default for evaluation.
Camera
- A default elevated frontal audience composition exists.
- The camera reveals the string arcs and the front/back organization.
- The camera uses perspective.
- The renderer/camera responds correctly to container resizing.
Debugging
- Development spatial aids can be enabled.
- The conductor origin can be inspected in debug mode.
- Instrument/subsection groupings can be inspected in debug mode.
- Debug tools are disabled in the normal prototype view.
Scope
- Deferred interaction and visual functionality has not been unnecessarily implemented.
- Temporary prototype choices are not represented as final product decisions.
Visual polish is not an acceptance criterion.

---


# 29. Manual evaluation questions
After Prototype 01A is implemented, review it visually before beginning Prototype 01B.
## 29.1 Orchestra readability
Does the composition read as a symphonic orchestra without:
- musicians;
- visible instruments;
- chairs;
- production labels?
Does the overall semicircular / fan-like foreground contribute to recognition?
## 29.2 String geometry
Do the strings feel like one large ensemble rather than separate blocks?
Can the eye perceive different string subsections without requiring large gaps?
Are the nested arcs:
- too regular;
- too geometric;
- too shallow;
- too deep;
- appropriately orchestra-like?
## 29.3 Density
Does the ensemble feel:
- too sparse;
- too dense;
- too uniform;
- too mathematically perfect;
- appropriately ensemble-like?
Which preset produces the strongest result?
## 29.4 Sectional structure
Without production labels, can the viewer perceive the hierarchy:
Strings
Woodwinds
Brass
Percussion
Does it feel like a front-to-back progression rather than four unrelated regions?
## 29.5 Instrument-level string grouping
Can the geometry plausibly contain:
1st Violins
2nd Violins
Violas
Cellos
Double Basses
without the overall string mass fragmenting?
This does not require users to identify each subsection yet.
The question is whether the geometry can support that later semantic distinction.
## 29.6 Silhouette
From the default camera, does the orchestra have a recognizable and intentionally composed silhouette?
Does the string arc establish the visual foundation?
Do the rear sections complete the shape rather than appearing as detached blocks?
## 29.7 Depth
Are foreground, middle, and rear groups clearly distinguishable?
Are woodwinds visible without becoming too broad?
Are brass clearly behind them?
Does percussion successfully form the rear edge?
## 29.8 Camera
Does the camera make the Installation feel like an object occupying space rather than a seating diagram?
Can the viewer understand the arcs?
Is there:
- enough perspective;
- too much perspective;
- enough elevation;
- too much elevation?
## 29.9 Negative space
Is there enough space:
- between individual players;
- between string subsections;
- between major families;
- around the entire orchestra
to support future light and motion?
Does added negative space weaken the sense of a single ensemble?
## 29.10 Comparison of presets
For each preset, record:
What works?
What fails?
What improves orchestral recognition?
What improves the installation-art quality?
What weakens ensemble cohesion?
What should be carried forward?

---


# 30. Open questions
The following questions remain deliberately unresolved.
Spatial
- exact seating configuration;
- exact player counts;
- exact angular ranges of the string subsections;
- exact double-bass placement;
- exact horn placement;
- exact woodwind seating rows;
- exact brass seating rows;
- exact percussion layout;
- whether alternative German / antiphonal string seating will eventually be supported;
- visual conductor presence.
Taxonomy
The core families are currently:
Strings
Woodwinds
Brass
Percussion
Possible auxiliary categories such as:
Harp
Keyboard
Piano
Celesta
Other repertoire-specific instruments
remain unresolved.
Do not promote auxiliary instruments into permanent top-level families solely to reproduce the current reference image.
Player object
- final form;
- dimensions;
- orientation;
- material;
- translucency;
- emissive behavior;
- relationship between object and represented player/instrument.
Visual language
- section colors;
- lighting;
- glow;
- bloom;
- reflections;
- floor treatment;
- atmospheric depth;
- section labels;
- typography.
Camera
- production camera position;
- camera movement;
- section-focus camera behavior;
- whether camera movement is desirable at all.
Interaction
- hover behavior;
- section selection;
- section focus;
- instrument selection;
- transition from section to instrument;
- deselection;
- relationship between scene and contextual UI.
Motion
- idle behavior;
- selection transitions;
- musical activity;
- entrance;
- rest;
- solo;
- crescendo;
- technique-specific movement.
Responsive
- desktop composition;
- tablet composition;
- mobile composition;
- touch interaction;
- orientation behavior.
Accessibility
- semantic orchestra navigation;
- keyboard interaction;
- focus behavior;
- non-color section differentiation;
- reduced-motion equivalent;
- representation of musical activity without relying on sound or animation.
Playback
- relationship between browsing and playback;
- Full audio mode;
- Highlight audio mode;
- Solo audio mode;
- score-driven musical activity.

---


# 31. Prototype iteration log
Prototype 01A — Geometry + Camera
Status: Current
Hypotheses
We are testing whether:
1. a conductor-centered seating model makes the abstract composition immediately more legible as an orchestra;
2. nested string arcs provide a stronger orchestral silhouette than rectangular section blocks;
3. the string family can contain meaningful instrument-level subdivisions while still reading as one continuous ensemble;
4. compact central woodwinds, rear brass, and rear percussion create a clear front-to-back hierarchy;
5. an elevated frontal perspective can provide both spatial presence and structural readability;
6. negative space can make the composition feel like a contemporary installation without destroying orchestral recognition;
7. simple geometry is sufficient to evaluate the spatial concept before visual treatment is introduced.
Previous implementation finding
The initial implementation used section-level rectangular bounds.
That approach successfully established rough family placement, but visually produced several detached blocks rather than one cohesive orchestra.
Specific issues identified:
- the strings appeared as two separated rectangular groups;
- the woodwind area was too broad relative to a conventional symphonic layout;
- horns were treated visually as a top-level family rather than part of brass;
- auxiliary keyboard positions occupied too much structural importance;
- the overall geometry did not sufficiently radiate around the conductor position.
The next 01A iteration should replace that block-based geometry with the conductor-centered hybrid radial model defined above.
Implementation
Implemented in `config.ts`, `seating.ts`, and `OrchestraScene.ts`.
The baseline generates 81 temporary positions: 56 strings (including five double
basses), eight woodwinds, eleven brass, and six percussion. All presets preserve
these counts and the same family/instrument topology. String subsections share
nested radii; short rear rows derive their depth from the outer string radius.
Normal rendering uses neutral cylinders. Instrument labels, family colors,
subsection bounds, conductor marker, grid, and orbit inspection are debug-only.
The reference-image glow, production labels, keyboard block, and visible conductor
have been superseded. Build and lint pass; visual evaluation remains pending.

Configuration: `strings` controls radii, rows, angular span, subsection weights/gaps,
and bass placement. `playerSpacing` scales node spacing; `sectionSpacing` scales
the gaps between rear families. Each rear family exposes width, gap, rows,
row spacing, and arc depth. Camera position is an offset from `conductorOrigin`;
camera target is an offset from the generated orchestra depth center.
Use the development preset selector or keys 1–3; D toggles debug mode.
`classical-wide` remains the default.
Findings
To be completed after visual review.
Established decisions resulting from this prototype
- Use the conductor position as the geometric origin of the seating layout.
- Model strings as instrument-level subgroups in the underlying seating data.
- Treat horns as part of Brass semantically.
These decisions remain open to reconsideration if later prototype evidence contradicts them.
Rejected / superseded approaches
Section-level rectangular blocks as the primary orchestra geometry
Reason:
They make the Installation read as a collection of categorized regions rather than as one spatially coherent orchestra.
Rectangular/debug bounds may continue to exist as development tools.
Questions carried forward
- What string arc radius feels most natural?
- How strongly should individual string subsections be separated?
- How symmetrical should the arrangement be?
- How much should real-world seating irregularity be introduced?
- Where should double basses sit in the Atlas baseline?
- How compact should the woodwinds be?
- How strongly should horns offset from the rest of the brass?
- How much negative space can be introduced before the orchestra stops reading as one ensemble?

---


# 32. Instructions to implementation agents

When implementing this specification:

1. Implement **only the prototype marked Current**.
2. Treat **Established decisions** as requirements.
3. Treat the **Current experiment** as the implementation brief.
4. Treat **Open questions** as intentionally unresolved.
5. Treat **Explicitly out of scope** as constraints.
6. Do not silently promote temporary prototype choices into product architecture.
7. Follow the existing repository's architecture, naming, styling, and dependency conventions where reasonable.
8. Prefer the smallest implementation that allows the current hypotheses to be evaluated properly.
9. Do not add speculative functionality for later prototypes.
10. Keep experimental variables easy to modify.
11. If an implementation detail is necessary but the product decision is unresolved, choose the simplest reversible option.
12. Document such temporary implementation choices clearly enough that they are not mistaken for approved design decisions.

The purpose of Prototype 01A is not to produce the finished Orchestra Installation.

The purpose is to create a useful object we can look at, manipulate, compare, and learn from.

**Optimize for learning and iteration, not apparent completeness.**
