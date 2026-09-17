# Map navigation and listening mix

## State ownership

- `src/store/navigation-store.ts` owns global spatial navigation. Its actions validate family/instrument IDs against the existing map catalog. Entering an instrument derives its family; Back changes only navigation. The URL is a projection of that state (`/strings/cello`); opening a path lands at that zoom and that mix.
- There is no independent listening-selection store. The audible mix is a projection of navigation: orchestra is even, a family highlights its channels, an instrument highlights that channel.
- `src/store/catalog.ts` reuses the default seating preset's instrument relationships, including Other → Celesta/Harp. `highlightedInstrumentIds` maps a navigation state to the channels that stay at full level.
- Scene camera interpolation and transient hover remain renderer state. Spatial lighting still follows navigation. Each mesh's `userData.nodeStates` exposes focus and the zoom-derived highlight set per instance. This metadata is a projection, not application state.
- Playback transport lives in `src/store/playback-store.ts`. Load progress lives in `src/store/listening-load-store.ts`. The Web Audio graph stays inside `src/features/listening/listening-engine.ts`.

## Interaction

Map click/tap, spatial labels, Back, and Escape navigate only. Zooming in *is* the mix change.

The top-bar transport plays, pauses, and seeks the shared recording. Play is disabled until at least one stem is ready. A draft loading indicator is shown in the player and on the stage while files decode.

Explore remains an independent no-op annotation on the focused instrument group.

## Audio contract

`connectListeningEngine` supplies the current mix and navigation updates. The listening engine maps those instrument IDs onto GainNodes and attenuates the rest by 15 dB. Orchestra (empty highlight set) is **normal**: every loaded channel stays at 0 dB. Family and instrument views are **highlight**. Gains ease slightly when the zoom changes; they do not yet ride the camera timeline.

One `AudioContext` schedules every stem. Do not play loosely synchronized `<audio>` elements. Duration is the shortest decoded buffer so channels stay together.

Stem URLs are the file map in `src/features/listening/stems.ts`: `/audio/beethoven-7th-2nd/{file}` under `public/audio`. Numbered parts (flute-1, flute-2) mix into one instrument channel. Instruments without a file (trombone, tuba, harp, celesta, extra percussion) have no channel. Rights are not inferred. Missing files leave that channel out; if none load, playback stays unavailable.

## Validation

`npm test` checks that the mix follows zoom, gain conversion, stem URLs, invalid IDs, subscription cleanup, and that playback does not write navigation. Browser review is required for loading, play/pause/seek, and highlight while zooming. The current excerpt files are a local file map only; rights are not recorded here.
