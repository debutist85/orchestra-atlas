# Contextual constellation prototype

Enabled for every violin hotspot. Add `?constellation=off` (or
`&constellation=off`) to compare the original Anatomy rail. Other instruments
retain the rail and their existing preview content.

## Content and interaction

Each hotspot has Discover, which displays its existing anatomical description.
Technique nodes are generated from `technique.ts`:

- Bow: Col legno (audio), Arco (video).
- Bridge: Sul ponticello (audio), Chords (audio), Pizzicato (video).
- Fingerboard: Harmonics (audio).
- Chinrest, F-hole, Pegbox, Scroll, Tailpiece: Discover only.

There are no generic Hear or Watch choices or intermediate media menus.
Discover closes back to the constellation without moving the camera. Video
opens the existing Performance player, preserving the selected hotspot and its
focus target. Closing Performance returns to its constellation. Back/Escape
closes Discover or Performance first, then returns to overview.

## Projection and animation

The viewer publishes the selected anchor's screen position, usable viewport and
camera-motion status through its existing render lifecycle. Camera completion
requests a final frame, allowing the constellation to reveal without a timeout.
Nodes are equally spaced on one circular path around the focused hotspot: three
nodes form a triangle, four form a diamond, and so on. They share one radius. That orbit sits a third closer to the hotspot than
the separation distance alone, and it contracts further when an edge leaves less room so the circle stays round
instead of clipping or collapsing into a grid. The controls keep the size set
by the window when a panel opens. The placement accounts for the
sidebar and actual stage dimensions. ResizeObserver feeds the existing
projection path. Coordinates update through refs, not React state.

GSAP sends nodes from the hotspot to their assigned positions over 400ms, with
25ms staggering and a short final label reveal. SVG line endpoints follow node
transforms during this same timeline. Controls are inert until arrival. Reduced
motion reveals immediately. In-flight animations are killed on state changes
and unmount. The overlay intercepts input only at controls and the annotation.

## Audio

`technique-audio-store.ts` owns one lazily created audio player. Audio nodes
play/pause/resume in place, with SVG progress rings driven by actual media
`timeupdate`/`durationchange` events. Progress is currentTime/duration, bounded
and guarded against unavailable duration. Media progress updates SVG directly;
React changes only when playback status changes. No added rendering loop or
unrelated progress timer is used.

Starting another sample resets the first. Ending resets the ring; the next click
replays. Changing hotspots, opening video or leaving Explore stops audio and
releases listeners and media resources. Main orchestral playback is coordinated
through the existing pause/resume utility. Media errors allow retry.

`public/audio/instruments/violin/chords.ogg` is the user-supplied shared prototype
audio; `public/videos/instruments/violin/arco.mp4` is the shared video placeholder.
Neither is a verified example of every linked technique. Controls expose the
placeholder status to assistive technology; videos retain a visible notice.
Recording rights and publication clearance remain unspecified and require human
review. No new media is downloaded or generated.

## Atmosphere and validation

A deterministic, non-interactive DOM field of 28 faint points (2–9px) adds
atmosphere without a WebGL scene, raycast targets or animation loop. It shares
the model layer's existing Performance dimming.

Focused tests cover media assignment, pause/resume, real progress, completion,
exclusivity, stale callbacks, errors, navigation cleanup, equal-radius circular
placement, label bounds and separation for one to four nodes across tested stage sizes.
Build and lint pass with existing warnings. Browser visual review, real playback,
touch, reduced-motion behavior and interrupted animations remain pending; no
browser is connected. The full suite has an existing unrelated artwork-width
assertion failure before the explorer suites.

During audio playback, only its contextual node and connection remain visible.
Other controls fade out and become inert. The associated technique title and
description appear in the same floating annotation treatment as Discover. The
playing node retains its Pause control and progress ring. Pausing, completion,
or an error restores the constellation; the annotation also offers Pause and
return. Media progress does not trigger React updates in the constellation.

Technique notes now remain open when audio pauses or finishes. Their top-right
close control (or Back/Escape) dismisses the note and restores the constellation.
The former Pause and return button is removed. The anatomical hotspot and its
label are hidden and inert only during actual audio playback, then restored.

## Description panel revision

Floating notes are replaced by the existing Anatomy panel treatment. Discover
opens the selected part description; an audio technique opens its own title and
description, without repeating the whole technique list. The panel stays open
after audio ends or pauses. Its boundary close control dismisses the contextual
layer and returns to the focused constellation, rather than zooming out.

The shared GSAP anatomy progress drives the panel from the right in landscape
and tablet portrait; phone portrait retains the bottom-sheet axis. Camera
projection reserves the animated description width/height independently of
Performance. The canvas buffer remains full-size. Existing non-contextual
Anatomy content and media controls remain available for other instruments.

Build/lint and focused audio, navigation and projection tests pass. Browser
review of the new panel transition remains pending.

Video selections now open their technique description in Anatomy alongside
Demonstration. Both use the shared GSAP timeline and matching panel widths.
Anatomy moves beside the video in landscape and tablet portrait. On a phone it
moves to the top of the stage, directly under the title, and the video fills
the stage that remains. Closing either contextual panel dismisses the video pair.
The video retains its placeholder-footage notice without repeating the
technique description. Browser review remains pending.
