type Props = { label: string; onClose: () => void }

export function PanelBoundary({ label, onClose }: Props) {
  return <div className="instrument-explore__boundary">
    <button type="button" className="instrument-explore__collapse" aria-label={label} onClick={onClose}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  </div>
}
