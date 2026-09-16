# Map navigation and listening selection

## State ownership

- `src/store/navigation-store.ts` owns global spatial navigation. Its actions validate family/instrument IDs against the existing map catalog. Entering an instrument derives its family; Back changes only navigation. The URL is a projection of that state (`/strings/cello`); opening a path selects the same destination.
- `src/store/listening-store.ts` owns immutable, deduplicated leaf instrument IDs and the requested listening mode. No selected-family state is stored. `familySelection` derives none/partial/all from the existing child groups, including Other → Celesta/Harp.
- `src/store/catalog.ts` reuses the default seating preset's instrument relationships. Current seating presets share those relationships; geometry/preset changes do not clear selection. If presets acquire different instrumentation, catalog ownership must be revisited explicitly.
- Scene camera interpolation and transient hover remain renderer state. Listening selection does not alter the current navigation lighting. Spatial labels expose Added/Some added; each mesh's `userData.nodeStates` exposes focus, listening membership, and derived family selection per instance. This metadata is a projection, not application state.

## Interaction

Map click/tap and spatial labels navigate only. Contextual Add/Remove changes listening selection only. Add on a partially selected family completes it; Remove on a fully selected family removes its children while retaining selections in other families. Explore is a map annotation on the focused instrument group and remains an independent callback.

Bottom controls expose Normal, Highlight, Isolate and Clear when instruments are selected. Normal preserves the selected set while restoring the full mix. Selection is persistent across navigation during the session; browser-reload storage is not introduced.

## Audio contract

There is no audio/MIDI engine in this project yet. `connectListeningEngine` in `src/features/listening/audio-selection.ts` immediately supplies the current selection and effective mode, subscribes to updates, and returns an unsubscribe function. A future engine maps these existing instrument IDs to its actual channels and applies the mix through its own scheduling layer.

Empty selection always derives an effective mode of **normal**, even if the requested mode is Highlight or Isolate. This keeps the user's mode preference for their next selection without risking empty-selection silence. Consumers must use `audioSelection`/`effectiveListeningMode`, not the requested mode alone. `channelGainDb` also guards empty input defensively.

Mix defaults are centralized: selected channels retain their normal balance (0 dB relative gain), Highlight attenuates other channels by 15 dB, and Isolate mutes other channels. The gain helper accepts alternative configuration. No React component manipulates channel volumes, and no audio playback is simulated.

## Validation

`npm test` checks navigation/selection independence, selection across branches, partial families, Other membership, duplicate prevention, empty-selection playback, mix settings, invalid IDs, and subscription cleanup using the existing Vite tooling. Build and lint remain separate checks. Browser review is required for visual layout, keyboard interaction and touch behavior.
