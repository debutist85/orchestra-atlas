import assert from 'node:assert/strict'

export async function verifyExperienceMode(server) {
  const { useExperienceStore } = await server.ssrLoadModule('/src/store/experience-store.ts')
  const { useNavigationStore } = await server.ssrLoadModule('/src/store/navigation-store.ts')
  const { canExplore, instrumentExperience } = await server.ssrLoadModule('/src/features/instrument-explorer/content/explorable-instruments.ts')
  const { exploreLayout } = await server.ssrLoadModule('/src/features/instrument-explorer/experience-motion.ts')
  const { usePlaybackStore } = await server.ssrLoadModule('/src/store/playback-store.ts')
  const { instrumentCatalog } = await server.ssrLoadModule('/src/store/catalog.ts')

  const navigation = useNavigationStore.getState()
  const experience = useExperienceStore.getState()
  navigation.resetToOrchestra()
  experience.exitExplore()
  const playbackBefore = usePlaybackStore.getState()

  assert.equal(experience.enterExplore(), false)
  assert.equal(useExperienceStore.getState().experienceMode, 'map')
  navigation.enterInstrument('viola')
  assert.equal(canExplore(useNavigationStore.getState().navigation), true)
  assert.equal(instrumentExperience(useNavigationStore.getState().navigation).name, 'Viola')
  assert.equal(instrumentExperience(useNavigationStore.getState().navigation).modelUrl, undefined)
  assert.equal(experience.enterExplore(), true)
  experience.exitExplore()

  for (const instrument of instrumentCatalog) {
    const state = { level: 'instrument', familyId: instrument.familyId, instrumentId: instrument.instrument }
    assert.equal(canExplore(state), true, instrument.name)
    const description = instrumentExperience(state).description
    assert.equal(typeof description, 'string', `${instrument.name} has a description`)
    assert.ok(description.length > 0 && description.length < 220, `${instrument.name}'s description is short`)
  }

  navigation.enterInstrument('violin')
  const violinNavigation = useNavigationStore.getState().navigation
  assert.equal(canExplore(violinNavigation), true)
  assert.equal(instrumentExperience(violinNavigation).name, 'Violin')
  assert.ok(instrumentExperience(violinNavigation).modelUrl.endsWith('/3d/violin/violin-web-anchors.glb'))
  assert.deepEqual(instrumentExperience(violinNavigation).modelRotation, [Math.PI / 2, 0, 0], 'the violin GLB is turned up from lying on its side')
  const experienceOf = (familyId, instrumentId) => instrumentExperience({ level: 'instrument', familyId, instrumentId })
  const horn = experienceOf('brass', 'horn')
  assert.equal(horn.name, 'Horn')
  assert.equal(horn.description, 'A middle voice of the orchestral brass family, between the trumpet and the trombone. Known for its warm, rounded tone.')
  assert.ok(horn.modelUrl.endsWith('/3d/horn/horn.glb'))
  assert.deepEqual(horn.modelRotation, [Math.PI, 0, 0], 'the horn is turned over')
  assert.deepEqual(horn.initialCamera, { target: [0, 0, 0], position: [3.4504, 1.3227, 0.5287] })
  const timpani = experienceOf('percussion', 'timpani')
  assert.ok(timpani.modelUrl.endsWith('/3d/timpani/timpani.glb'), 'timpani has its own model')
  assert.deepEqual(timpani.modelRotation, [0, 0, 0])
  assert.equal(timpani.initialCamera, undefined)
  const doubleBass = experienceOf('strings', 'doubleBass')
  assert.ok(doubleBass.modelUrl.endsWith('/3d/double-bass/double-bass.glb'))
  const flute = experienceOf('woodwinds', 'flute')
  assert.equal(flute.name, 'Flute')
  assert.ok(flute.modelUrl.endsWith('/3d/flute/flute.glb'))
  assert.deepEqual(flute.modelRotation, [0, Math.PI / 2, 0], 'the flute is turned from pointing at the camera')
  assert.deepEqual(flute.initialCamera, { target: [0, 0, 0], position: [-44.3396, 40.3268, 41.4444] })
  const trombone = experienceOf('brass', 'trombone')
  assert.ok(trombone.modelUrl.endsWith('/3d/trombone/trombone.glb'))
  assert.deepEqual(trombone.modelRotation, [0, 0, 0])
  assert.deepEqual(trombone.initialCamera, { target: [0, 0, 0], position: [4.5950, 3.5221, 1.9918] })
  assert.equal(experienceOf('percussion', 'unpitchedPercussion').modelUrl, undefined, 'no model without a table entry')
  assert.equal(experience.enterExplore(), true)
  assert.equal(useExperienceStore.getState().experienceMode, 'explore')
  assert.deepEqual(useNavigationStore.getState().navigation, violinNavigation)
  assert.strictEqual(usePlaybackStore.getState().status, playbackBefore.status)
  assert.strictEqual(usePlaybackStore.getState().position, playbackBefore.position)

  // Repeated/rapid semantic actions settle deterministically without changing
  // the underlying instrument location.
  experience.exitExplore()
  experience.enterExplore()
  experience.exitExplore()
  assert.equal(useExperienceStore.getState().experienceMode, 'map')
  assert.deepEqual(useNavigationStore.getState().navigation, violinNavigation)

  const content = { left: 300, top: 220, width: 760, height: 310 }
  const desktop = exploreLayout({ width: 1440, height: 900 }, { width: 1440, height: 800, top: 50 }, content)
  assert.ok(desktop.scale >= 0.132 && desktop.scale <= 0.39)
  assert.ok(desktop.x < 0 && desktop.y < 0)
  assert.notEqual(desktop.clipPath, 'inset(0px 0px 0px 0px)')
  assert.equal(desktop.minimap.left, 0)
  assert.ok(desktop.minimap.width > 0 && desktop.minimap.height > 0)
  // Portrait phone: the miniature stays, small, in the top-left corner.
  const safe = { top: 38, right: 16, bottom: 86, left: 16 }
  const mobile = exploreLayout({ width: 390, height: 844 }, { width: 390, height: 744, top: 50 }, content, safe)
  assert.deepEqual([mobile.minimap.left, mobile.minimap.top], [16, 38])
  assert.ok(mobile.minimap.width < 390 / 2, 'leaves room for the labels beside it')
  // The visible miniature is where the stage transform actually puts the crop.
  const cropLeft = Number(/inset\([\d.]+px [\d.]+px [\d.]+px ([\d.]+)px\)/.exec(mobile.clipPath)[1])
  assert.ok(Math.abs(mobile.x + cropLeft * mobile.scale - mobile.minimap.left) < 1e-6)
  // Phone on its side: the miniature still stays, top-left.
  const sideways = exploreLayout({ width: 667, height: 375 }, { width: 667, height: 275, top: 50 }, content, safe)
  assert.deepEqual([sideways.minimap.left, sideways.minimap.top], [16, 38])
  assert.ok(sideways.minimap.height <= 375 * 0.25, 'small on a short screen')
  // Upright phones get a larger miniature than the same fit gives elsewhere;
  // phones on their side a smaller one.
  const fit = viewport => exploreLayout(viewport, { width: viewport.width, height: viewport.height - 100, top: 50 }, content).scale
  assert.ok(fit({ width: 390, height: 844 }) > fit({ width: 520, height: 844 }) * 1.3)
  assert.ok(fit({ width: 667, height: 375 }) < fit({ width: 667, height: 520 }))

  navigation.resetToOrchestra()
  console.log('Passed experience eligibility, independent mode/navigation state, playback preservation, rapid mode actions, and responsive map targets.')
}
