# Orchestra Atlas — Vision

## Overview

Orchestra Atlas is a highly interactive web experience for exploring the symphonic orchestra through sound, space, motion, and notation.

It combines:

- an interactive 3D orchestra
- detailed 3D instrument exploration
- instrument anatomy
- playing techniques
- real orchestral recordings
- isolated and grouped audio stems where available
- synchronized sheet music
- performance video
- contextual explanations of orchestration

The project is both an educational and cultural experience and a flagship portfolio piece demonstrating design engineering and creative technology.

The goal is not to build a complete digital encyclopedia of every orchestral instrument and composition. The goal is to create a smaller, deeply crafted experience that shows how physical instruments, performance technique, notation, and orchestral sound relate to one another.

---

## Purpose

Orchestra Atlas should help users understand the orchestra through interaction rather than passive reading.

A visitor should be able to move fluidly between questions such as:

- What does this instrument look like?
- How is it constructed?
- How does a player produce this sound?
- What does a technique such as pizzicato, tremolo, or col legno physically involve?
- What does that technique sound like by itself?
- Where does it appear in a real orchestral work?
- What does it look like in the score?
- What happens when I isolate or emphasize that instrument inside the orchestra?
- How does orchestration change between historical periods and musical styles?

The experience should connect these questions into one coherent system rather than treating them as separate sections.

### A Contemporary Orchestra

Orchestra Atlas also aims to challenge the perception that symphonic music is inherently old-fashioned, elitist, inaccessible, or reserved for people who already understand classical music.

The orchestra should be presented as a living, evolving medium: physical, expressive, experimental, and relevant to contemporary culture.

The experience should encourage curiosity without assuming prior musical education. Musical terminology should not be avoided, but it should be introduced through sound, interaction, and clear explanation rather than treated as prerequisite knowledge.

The project should feel welcoming to someone encountering an orchestra for the first time while retaining enough depth to reward musicians and experienced listeners.

Contemporary repertoire, living composers, modern performance techniques, and unconventional orchestral sounds should eventually sit naturally alongside historical repertoire.

The visual and interaction design should reinforce this position. Orchestra Atlas should feel culturally contemporary without attempting to make orchestral music "cool" through superficial visual trends.

---

## Portfolio Goal

Orchestra Atlas is intended to demonstrate the skills required of a design engineer / creative technologist.

The project should showcase:

- advanced frontend engineering
- Three.js / WebGL
- interaction design
- motion design
- real-time audio
- synchronized multimedia
- data-driven UI
- information architecture
- responsive design
- accessibility
- creative coding
- content systems
- AI-assisted development workflows

The final result should feel like a designed digital cultural experience, not a generic technical demo.

---

## Audience

Orchestra Atlas is designed for curious people, not only existing classical-music audiences.

Potential users include:

- someone who has never attended a symphonic concert
- someone who recognizes orchestral music from films, games, or popular culture but knows little about the instruments
- students discovering orchestral music
- amateur and professional musicians
- composers and orchestration students
- experienced concertgoers interested in exploring familiar repertoire differently

The experience should not assume that familiarity with classical music, notation, terminology, or concert culture is required to belong in the audience.

---

## Core Experience Model

The main conceptual structure is:

```text
ORCHESTRA
   ↓
SECTION
   ↓
INSTRUMENT
   ├── anatomy
   ├── sound
   ├── techniques
   └── performance
          ↓
REPERTOIRE
   ├── recording
   ├── interactive score
   ├── video
   └── orchestration
```

This structure is not strictly linear.

The user should be able to move in multiple directions:

- instrument → technique → musical excerpt
- score → instrument → anatomy
- repertoire → orchestral section
- technique → score marking
- audio → highlighted instrument
- orchestra → section → individual instrument

The project should feel exploratory rather than hierarchical.

---

## Signature Interaction

The central visual metaphor is an illuminated orchestra.

Instead of representing the orchestra as literal chairs and musicians, each player or instrumental position is represented by a luminous object arranged according to orchestral seating.

The result should feel like a contemporary light installation or spatial sculpture.

The installation serves several purposes simultaneously:

- navigation
- orchestra map
- section identification
- musical visualization
- playback feedback
- visual identity

Different instrumental families may be distinguished using a restrained color system inspired by the Budapest Festival Orchestra's visual language, without directly reproducing its logo.

The orchestra should exist in a dark, spatial environment with strong use of negative space, light, translucency, depth, and subtle reflection.

The aesthetic should feel closer to contemporary installation art and editorial cultural design than to a game interface or conventional educational website.

---

## Music-Driven Visualization

The illuminated orchestra should respond to musical structure.

The animation should be driven by score and playback data where possible, not only by raw audio amplitude.

Examples:

- an instrument entry causes its light to appear or intensify
- a solo causes one position to become visually dominant
- a section entrance activates a group
- a crescendo increases intensity gradually
- pizzicato produces short, precise impulses
- tremolo may create a subtle shimmer
- a rest causes a light to recede
- tutti activates the full installation

The visualization should communicate musical activity rather than behave like a generic audio visualizer.

---

## Instrument Exploration

Each instrument should have a dedicated inspection experience.

The user may:

- rotate and inspect a 3D model
- zoom into significant parts
- reveal annotated anatomical features
- understand how sound is produced
- explore playing techniques
- listen to isolated examples
- jump to repertoire examples

Annotations should be tied to the actual model geometry where possible.

For example, a violin might expose:

- bridge
- fingerboard
- strings
- sound holes
- tailpiece
- pegs
- bow
- contact regions used for techniques such as sul ponticello and sul tasto

The 3D model should be functional, not decorative.

---

## Technique Exploration

Playing techniques are a core part of the experience.

Examples include:

### Strings

- pizzicato
- tremolo
- col legno
- sul ponticello
- sul tasto
- harmonics
- glissando
- spiccato

### Woodwinds

- flutter tonguing
- harmonics
- alternate fingerings
- multiphonics where appropriate

### Brass

- mute techniques
- stopped horn
- flutter tonguing
- lip trills

Each technique should ideally connect four kinds of information:

1. physical action
2. isolated sound
3. notation
4. orchestral context

The user should be able to understand not only what a technique is called, but how it is performed and why it sounds the way it does.

---

## Interactive Score

Sheet music should be treated as an interactive interface, not a static image.

The project should use structured notation data where practical, such as MusicXML.

The score should support interactions such as:

- highlighting the currently sounding measure
- following playback
- selecting an instrument staff
- jumping playback by clicking a measure
- identifying playing techniques
- synchronizing score and audio
- highlighting active orchestral sections
- linking notation back to instrument and technique views

The score should support multiple levels of musical literacy.

Possible modes include:

- full conductor's score
- focused instrument view
- simplified visual timeline for non-readers

The experience should remain understandable even for users who cannot read conventional notation.

---

## Interactive Audio

Real recordings are strongly preferred.

Where multitrack or stemmed material is available, users should be able to manipulate the orchestral mix.

Possible states include:

- Full Orchestra
- Highlight
- Solo

"Highlight" is especially important.

Instead of muting the entire orchestra, the selected instrument or section may remain at normal level while the rest is attenuated.

This helps the listener understand how an instrument sits inside the orchestral texture.

For example:

```text
Full Orchestra

Selected instrument: 0 dB
Rest of orchestra: 0 dB
```

```text
Highlight Instrument

Selected instrument: 0 dB
Rest of orchestra: -15 dB
```

```text
Solo Instrument

Selected instrument: 0 dB
Rest of orchestra: muted or heavily attenuated
```

Audio synchronization should use a shared playback timeline rather than independent media elements wherever possible.

---

## Real Performances and Repertoire

The experience should feature real orchestral performances whenever licensing permits.

The repertoire should eventually represent multiple periods and approaches to orchestration, including:

- Classical
- Romantic
- late Romantic
- early 20th century
- later 20th century
- contemporary music

The project should use a curated set of examples rather than trying to cover the entire repertoire.

Each example should have a clear educational or exploratory purpose.

Examples might demonstrate:

- orchestral color
- instrument combinations
- solo passages
- section writing
- unusual techniques
- changes in orchestration across historical periods

Historical repertoire should not be presented as a closed canon. Contemporary works and living composers should help demonstrate that orchestral music continues to evolve.

---

## Video

Performance video should support the user's understanding of physical technique and orchestral context.

Video may be used for:

- demonstrations by individual players
- bowing or fingering techniques
- instrument handling
- orchestral performance excerpts
- identifying where a player sits in the orchestra

Video should be integrated contextually rather than presented as a separate media gallery.

---

## Responsive Experience

Orchestra Atlas is a web experience and must be designed for a broad range of viewport sizes and input methods.

Mobile is a first-class experience, not a reduced desktop fallback.

The interface should be designed for:

- desktop
- tablet
- mobile
- pointer input
- touch input
- keyboard input where applicable

The same core content and exploratory journey should be available across viewport sizes, although the interaction model may adapt to the device.

Responsive design does not require identical layouts or interactions.

For example:

- a desktop orchestra may use spatial hover and camera movement
- a mobile orchestra may use tap, drag, and focused section navigation
- desktop instrument annotations may surround the 3D model
- mobile annotations may appear in a bottom sheet
- a conductor's score may show many staves simultaneously on desktop
- mobile may use a focused instrument score with horizontal navigation
- complex secondary controls may move into contextual panels on smaller screens

Touch targets, gesture conflicts, device performance, orientation changes, and limited screen space should be considered during interaction design rather than addressed after desktop implementation.

3D scenes should degrade gracefully on lower-powered devices.

---

## Accessibility

Accessibility is part of the experience design, not a fallback added after the interactive version has been completed.

Core information and navigation should not depend exclusively on:

- color
- sound
- precise pointer interaction
- 3D spatial understanding
- animation
- the ability to read musical notation

Where appropriate, interactions should support:

- keyboard navigation
- screen readers
- captions and transcripts
- reduced motion
- sufficient contrast
- visible focus states
- accessible touch targets
- alternative representations of spatial or musical information

Audio-dependent experiences should provide meaningful visual or textual context.

Visual experiences should not require audio in order to navigate or understand their basic purpose.

The project should aim to meet WCAG 2.2 AA requirements where applicable while recognizing that experimental 3D and musical interfaces may require carefully designed equivalent experiences rather than identical interactions.

The WebGL scene should not become the sole representation of application state. Important information exposed visually through the 3D experience should have an accessible semantic representation in the surrounding web interface where practical.

Accessibility should be considered a creative design constraint capable of producing better interactions, rather than merely a compliance requirement.

---

## Licensing and Rights

Licensing is a first-class project concern.

The project must distinguish between:

- composition copyright
- performance rights
- sound recording rights
- video rights
- 3D model licenses
- image licenses
- sample-library restrictions
- attribution requirements

A public-domain composition does not imply that a specific recording is public domain.

Every external asset should include structured rights metadata.

The system must never infer that an asset is safe to use simply because it is publicly accessible online.

Licensing uncertainty should be explicitly recorded.

AI agents must never invent licensing metadata.

Human review is required before externally sourced media becomes part of the published experience.

---

## Content Philosophy

The experience should use real musicians, real instruments, and real orchestral performances wherever practical.

Synthetic or sampled orchestral rendering may be useful for prototyping, testing, or specific educational demonstrations, but it should not define the final musical experience.

Content quality is more important than quantity.

Four beautifully presented instruments are more valuable than thirty shallow instrument pages.

The project should feel curated rather than exhaustive.

---

## Visual Direction

The visual identity should combine:

- contemporary cultural-institution design
- editorial typography
- cinematic motion
- dark spatial environments
- luminous objects
- glass-like or translucent materials
- restrained but expressive color
- strong negative space
- clear and accessible information design

Avoid:

- generic WebGL particle effects
- neon cyberpunk aesthetics
- literal concert-hall simulation
- skeuomorphic controls
- game-like HUD interfaces
- excessive gradients
- decorative animation without musical meaning
- dashboard-like layouts
- visual complexity that compromises usability

The experience should feel elegant, modern, tactile, exploratory, and welcoming.

Contemporary design should not come at the expense of legibility, accessibility, or clarity.

---

## Interaction Principles

### Music first

Visual effects should support musical understanding.

### Learn by manipulating

Users should interact, compare, isolate, rotate, scrub, highlight, and explore rather than primarily consume explanatory text.

### Physical → sonic → musical

Where possible, connect:

```text
physical action
    ↓
resulting sound
    ↓
notation
    ↓
orchestral use
```

### Multiple levels of expertise

The experience should remain engaging for users with very different levels of musical knowledge.

It should provide intuitive entry points for newcomers while allowing deeper exploration for musicians and experienced listeners.

### Accessible by design

Accessibility should influence interaction design from the beginning.

Alternative interaction modes should preserve the purpose of an experience rather than merely reproduce its mechanics.

### Mobile is not secondary

Core experiences should be designed with touch and small screens in mind from the beginning.

Responsive adaptation should be considered part of interaction design.

### Elegant, not gamified

The experience should invite exploration without points, badges, scores, or artificial progression systems.

### Interconnected content

Avoid isolated content silos.

Instrument, technique, score, recording, video, and repertoire should cross-link naturally.

### Technology should earn its place

3D, animation, audio processing, and other technical effects should be used because they enable an experience that simpler media cannot provide.

Technical complexity is not itself a design goal.

---

## AI and Agentic Development

AI is primarily part of the production workflow rather than the visible concept of the experience.

AI agents may assist with:

- research
- content structuring
- rights research
- metadata normalization
- MusicXML analysis
- asset processing
- code implementation
- testing
- accessibility review
- technical review
- documentation

Human review remains required for:

- design decisions
- historical and musical accuracy
- legal and licensing decisions
- final content
- visual quality
- interaction quality

The goal is to demonstrate an AI-assisted design and engineering workflow, not to produce an "AI website."

The project repository and its documentation should act as the shared source of truth for human and agent contributors.

---

## Initial Scope

The first release should prioritize depth over breadth.

### Orchestra

- one interactive illuminated orchestra installation
- section-level navigation

### Instruments

Approximately four instruments representing different families.

Possible initial set:

- violin
- cello
- flute
- French horn

The exact selection may change according to the quality and licensing of available 3D models, recordings, samples, video, and repertoire.

### Techniques

Approximately 3–5 techniques per selected instrument.

### Repertoire

Approximately two carefully selected excerpts.

Ideally:

- one 19th-century example
- one 20th- or 21st-century example

### Audio

At least one example supporting meaningful section or instrument highlighting using real multitrack or stemmed material where licensing permits.

### Score

At least one synchronized interactive score excerpt.

### Video

At least one real-player technique demonstration or performance example.

### 3D

Each selected instrument should support:

- rotation
- zoom
- anatomical hotspots
- technique-related regions

### Responsive Design

The core experience should be usable on both desktop and mobile in the initial release.

### Accessibility

Core navigation and content should have accessible alternatives from the initial release rather than being postponed to a later accessibility pass.

---

## Non-Goals for the Initial Version

The first version does not need:

- every orchestral instrument
- a complete history of orchestral music
- full-length symphonies
- advanced music-theory instruction
- user accounts
- social features
- a full DAW-style mixer
- photorealistic simulation of a concert hall
- generative AI as a central user-facing feature
- identical interaction patterns across desktop and mobile
- exhaustive repertoire coverage

These may be explored later if they strengthen the core experience.

---

## Success Criteria

The project succeeds if:

- a visitor immediately understands that the orchestra is interactive
- the visual identity feels memorable and distinct
- the experience feels contemporary without trivializing its subject
- people without prior classical-music knowledge feel invited to explore
- 3D interaction serves an educational or experiential purpose
- music playback and visualization feel tightly synchronized
- users can clearly hear the role of an instrument or section
- techniques connect physical action, notation, and sound
- the interactive score adds meaningful understanding
- real orchestral content feels central rather than ornamental
- mobile feels intentionally designed rather than adapted after desktop
- accessibility is embedded in the interaction model
- the project demonstrates strong design-engineering craft
- the codebase and content system are structured enough to scale
- the project can be presented as a compelling creative-technology case study

---

## Guiding Question

Every major design and engineering decision should answer:

> Does this help the user understand, hear, or experience the orchestra in a way that static text, images, or video alone cannot?