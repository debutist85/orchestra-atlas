import { useListeningLockStore } from '../../store/listening-lock-store'

// Lets a listener keep hearing the full orchestra regardless of navigation —
// the map can still be explored and zoomed into visually, but audio stays
// on the full mix instead of switching to solo playback. See
// effectiveAudioSelection in audio-selection.ts for where this is applied.
export function FullOrchestraLock() {
  const locked = useListeningLockStore(state => state.lockFullOrchestra)
  const toggle = useListeningLockStore(state => state.toggleLockFullOrchestra)

  return (
    <button
      type="button"
      className="full-orchestra-lock"
      aria-pressed={locked}
      aria-label={locked ? 'Full orchestra locked on' : 'Lock full orchestra'}
      title={locked ? 'Always hearing the full orchestra' : 'Keep hearing the full orchestra while exploring'}
      onClick={toggle}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true">
        {locked
          ? <path d="M3 5.5V4a3 3 0 0 1 6 0v1.5h.5a.5.5 0 0 1 .5.5v4a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-4a.5.5 0 0 1 .5-.5H3Zm1 0h4V4a2 2 0 0 0-4 0v1.5Z" />
          : <path d="M4 5.5V4a2 2 0 0 1 3.9-.6.5.5 0 1 0 .95-.32A3 3 0 0 0 3 4v1.5h-.5a.5.5 0 0 0-.5.5v4a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H4Z" />}
      </svg>
      <span className="full-orchestra-lock__label" aria-hidden="true">Full orchestra</span>
    </button>
  )
}
