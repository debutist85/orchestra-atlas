import assert from 'node:assert/strict'

export async function verifyExperienceMode(server) {
  const { useExperienceStore } = await server.ssrLoadModule('/src/store/experience-store.ts')
  const { useNavigationStore } = await server.ssrLoadModule('/src/store/navigation-store.ts')
  const { canExplore, instrumentExperience } = await server.ssrLoadModule('/src/features/instrument-explorer/explorable-instruments.ts')
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
  navigation.enterInstrument('cello')
  assert.equal(canExplore(useNavigationStore.getState().navigation), true)
  assert.equal(instrumentExperience(useNavigationStore.getState().navigation).name, 'Cello')
  assert.equal(instrumentExperience(useNavigationStore.getState().navigation).modelUrl, undefined)
  assert.equal(experience.enterExplore(), true)
  experience.exitExplore()

  for (const instrument of instrumentCatalog) {
    const state = { level: 'instrument', familyId: instrument.familyId, instrumentId: instrument.instrument }
    assert.equal(canExplore(state), true, instrument.name)
  }

  navigation.enterInstrument('violin')
  const violinNavigation = useNavigationStore.getState().navigation
  assert.equal(canExplore(violinNavigation), true)
  assert.equal(instrumentExperience(violinNavigation).name, 'Violin')
  assert.ok(instrumentExperience(violinNavigation).modelUrl.endsWith('/3d/violin/violin-web-anchors.glb'))
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
  assert.equal(desktop.contextualMapVisible, true)
  assert.ok(desktop.x < 0 && desktop.y < 0)
  assert.notEqual(desktop.clipPath, 'inset(0px 0px 0px 0px)')
  const mobile = exploreLayout({ width: 390, height: 844 }, { width: 390, height: 744, top: 50 })
  assert.equal(mobile.contextualMapVisible, false)
  assert.ok(mobile.y + 744 * mobile.scale < 50)

  navigation.resetToOrchestra()
  console.log('Passed experience eligibility, independent mode/navigation state, playback preservation, rapid mode actions, and responsive map targets.')
}
