import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

function luminance(hex) {
  const [r, g, b] = hex.slice(1).match(/.{2}/g).map(part => {
    const value = parseInt(part, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return r * 0.2126 + g * 0.7152 + b * 0.0722
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

export async function verifyInstrumentColors(server) {
  const { instrumentColors, colorsForInstrument, explorationNeutralColors } = await server.ssrLoadModule('/src/theme/instrument-colors.ts')
  const { orchestraSceneConfig } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const { InstrumentExplore } = await server.ssrLoadModule('/src/features/instrument-explorer/InstrumentExplore.tsx')
  const { useAnatomyStore } = await server.ssrLoadModule('/src/store/anatomy-store.ts')

  // Historical map accents: adopting tokens must not change their values.
  const accents = {
    violin: '#F0772F', viola: '#F75A71', cello: '#FF0F7B', doubleBass: '#C8168F',
    flute: '#2FD8E8', oboe: '#4A7FD6', clarinet: '#376BC9', bassoon: '#5B45C8',
    horn: '#F4D941', trumpet: '#F0AE3B', trombone: '#EC8235', tuba: '#E06028',
    timpani: '#DF9CBC', pitchedPercussion: '#78509E', unpitchedPercussion: '#A76BBB',
    harp: '#E65763', celesta: '#2CB2BA',
  }
  for (const group of Object.values(orchestraSceneConfig.instrumentGroups).flat()) {
    assert.equal(group.color.toUpperCase(), accents[group.instrument])
    assert.equal(group.color, colorsForInstrument(group.instrument).accent)
  }
  const violin = orchestraSceneConfig.instrumentGroups.strings.find(group => group.instrument === 'violin')
  assert.equal(violin.colorBands[0].color, '#F0772F')
  assert.equal(violin.colorBands[1].color, '#F26850')
  assert.equal(colorsForInstrument('violin2'), instrumentColors.secondViolins)
  assert.equal(colorsForInstrument('doubleBass'), instrumentColors.contrabass)

  let minimumPrimary = Infinity
  let minimumMuted = Infinity
  const accentsBelowTextContrast = []
  for (const [id, tokens] of Object.entries(instrumentColors)) {
    const primary = contrast(tokens.text, tokens.surface)
    const muted = contrast(tokens.muted, tokens.surface)
    assert.ok(primary >= 4.5, `${id} primary text contrast: ${primary}`)
    assert.ok(muted >= 4.5, `${id} secondary/dimmed text contrast: ${muted}`)
    minimumPrimary = Math.min(minimumPrimary, primary)
    minimumMuted = Math.min(minimumMuted, muted)
    if (contrast(tokens.accent, tokens.surface) < 4.5) accentsBelowTextContrast.push(id)
  }
  assert.ok(contrast(explorationNeutralColors.text, explorationNeutralColors.surface) >= 4.5)

  const representative = ['violin', 'cello', 'flute', 'clarinet', 'horn', 'timpani', 'pitchedPercussion', 'celesta']
  const props = id => ({ experience: { instrumentId: id, name: id }, loadModel: false, onModelError() {}, onModelReady() {} })
  // Server rendering normally reads Zustand's original empty snapshot. Supply
  // each test scenario as that snapshot without changing application behavior.
  const initialSnapshot = useAnatomyStore.getInitialState()
  const originalSnapshot = { ...initialSnapshot }
  const renderScenario = id => {
    Object.assign(initialSnapshot, useAnatomyStore.getState())
    return renderToStaticMarkup(createElement(InstrumentExplore, props(id)))
  }
  try {
    useAnatomyStore.getState().returnToInstrument()
    for (const id of representative) {
      const markup = renderScenario(id)
      const tokens = colorsForInstrument(id)
      assert.ok(markup.includes(`--instrument-surface:${tokens.surface}`), id)
      assert.ok(markup.includes('--exploration-neutral-surface:#252321'), id)
      assert.ok(markup.includes('data-part-open="false"'), id)
    }
    useAnatomyStore.getState().selectAnatomyPart('Anchor_Chinrest')
    useAnatomyStore.getState().openPerformance('stroke', 'timpani')
    const performance = renderScenario('timpani')
    assert.ok(performance.includes('data-active="true"'))
    assert.ok(performance.includes('Currently demonstrated technique'))
    assert.ok(performance.includes('text-[color:var(--instrument-muted)]'))
    assert.ok(performance.includes('bg-[var(--stage-background)]'), 'performance stays neutral')
    assert.ok(performance.includes('bg-[var(--instrument-surface)]'), 'anatomy keeps its surface')
    assert.ok(!performance.includes('opacity-50'), 'do not dim the entire anatomy panel')
    useAnatomyStore.getState().closeDemonstration()
    const anatomy = renderScenario('timpani')
    assert.ok(!anatomy.includes('data-active="true"'))
    assert.ok(anatomy.includes('data-part-open="true"'))
  } finally {
    useAnatomyStore.getState().returnToInstrument()
    Object.assign(initialSnapshot, originalSnapshot)
  }
  console.log(`Passed palette mapping, unchanged map accents, panel state markup and all 18 palettes' contrast. Minimum primary ${minimumPrimary.toFixed(2)}:1; muted ${minimumMuted.toFixed(2)}:1. Accents unsuitable for normal text: ${accentsBelowTextContrast.join(', ')}.`)
}
