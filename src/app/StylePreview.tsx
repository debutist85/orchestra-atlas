import { useState, type CSSProperties } from 'react'
import { Loader } from '../components/Loader'
import { FullOrchestraLock } from '../features/listening/FullOrchestraLock'
import { HeaderBackButton } from '../features/orchestra-map/components/HeaderBackButton'
import { ExplorationHint } from '../features/orchestra-map/components/ExplorationHint'

const colors = [
  ['Page', '--color-surface-page'],
  ['Primary text', '--color-text-primary'],
  ['Control text', '--color-text-control'],
  ['Secondary text', '--color-text-secondary'],
  ['Muted text', '--color-text-muted'],
  ['Focus', '--color-focus'],
] as const

export default function StylePreview() {
  const [position, setPosition] = useState(35)
  const [disabled, setDisabled] = useState(false)
  const [preparing, setPreparing] = useState(false)

  return <main className="style-preview mx-auto max-w-[64rem] pt-8 pr-[max(1rem,env(safe-area-inset-right))] pb-16 pl-[max(1rem,env(safe-area-inset-left))] leading-normal">
    <header>
      <p className="my-4">Development / Orchestra Atlas</p>
      <h1 className="font-identity text-[clamp(2rem,6vw,4rem)] leading-[1.1] font-normal">Style foundations</h1>
      <p className="my-4">Existing styles in isolation. Use Tab to inspect focus and resize to review small screens.</p>
      <a className="underline underline-offset-[0.2em] focus-visible:outline-solid focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus focus-visible:outline-offset-[3px]" href="/">Return to the orchestra</a>
    </header>
    <section className="mt-10 border-t border-stone pt-4" aria-labelledby="preview-colors">
      <h2 className="mb-4 text-[1.25rem]" id="preview-colors">Semantic colors</h2>
      <ul className="style-preview__colors grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-4 p-0 list-none">
        {colors.map(([label, token]) => <li className="grid gap-2" key={token}>
          <span className="style-preview__swatch h-12 border border-stone" style={{ background: `var(${token})` }} aria-hidden="true" />
          <strong>{label}</strong><code className="[overflow-wrap:anywhere] text-[0.8rem]">{token}</code>
        </li>)}
      </ul>
    </section>
    <section className="mt-10 border-t border-stone pt-4" aria-labelledby="preview-type">
      <h2 className="mb-4 text-[1.25rem]" id="preview-type">Typography</h2>
      <p className="my-4 font-identity text-4xl">Explore the orchestra</p>
      <p className="my-4 font-ui">Ordinary interface text uses the system UI font.</p>
      <p className="my-4 style-preview__control-label text-control-label tracking-control uppercase">Shared control label / 0.7rem / 0.04em</p>
    </section>
    <section className="mt-10 border-t border-stone pt-4" aria-labelledby="preview-controls">
      <h2 className="mb-4 text-[1.25rem]" id="preview-controls">Controls</h2>
      <p className="my-4">The lock and loaders are live components. The range and back button are style specimens; they do not control the orchestra.</p>
      <div className="style-preview__row my-6 flex flex-wrap items-center gap-6"><FullOrchestraLock /><Loader label="Default loader specimen" /><Loader label="Small loader specimen" size={20} /></div>
      <label className="style-preview__row my-6 flex flex-wrap items-center gap-6">
        <input type="checkbox" checked={disabled} onChange={event => setDisabled(event.target.checked)} />
        Disable back-button specimen
      </label>
      <div className="style-preview__chrome flex min-h-0 min-w-0 items-stretch overflow-hidden">
        <HeaderBackButton disabled={disabled}>← Orchestra</HeaderBackButton>
      </div>
      <label className="style-preview__range my-6 grid max-w-[29rem] gap-3">
        Playback range specimen: {position}%
        <input type="range" min={0} max={100} value={position}
          className="playback__progress h-4 w-full appearance-none bg-transparent"
          style={{ '--playback-progress': `${position}%` } as CSSProperties}
          onChange={event => setPosition(Number(event.target.value))} />
      </label>
      <p className="my-4">Reduced-motion behavior follows your system preference. This preview does not start audio or mount the 3D scene.</p>
    </section>
    <section className="mt-10 border-t border-stone pt-4" aria-labelledby="preview-preparation">
      <h2 className="mb-4 text-[1.25rem]" id="preview-preparation">Instrument preparation</h2>
      <label className="my-6 flex items-center gap-3">
        <input type="checkbox" checked={preparing} onChange={event => setPreparing(event.target.checked)} />
        Simulate preparing Violin
      </label>
      <ExplorationHint state={{ level: 'instrument', familyId: 'strings', instrumentId: 'violin' }}
        name="Violin" loading={preparing} />
    </section>
  </main>
}
