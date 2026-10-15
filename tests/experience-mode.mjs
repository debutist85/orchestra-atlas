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
  assert.ok(instrumentExperience(useNavigationStore.getState().navigation).modelUrl.endsWith('/3d/violin/violin-web-anchors.glb'))
  assert.equal(instrumentExperience(useNavigationStore.getState().navigation).placeholderModel, true)
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
  const timpani = instrumentExperience({ level: 'instrument', familyId: 'percussion', instrumentId: 'timpani' })
  assert.equal(timpani.name, 'Timpani')
  assert.equal(timpani.modelUrl, instrumentExperience(violinNavigation).modelUrl, 'timpani borrows the violin model until it has its own')
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
  assert.equal(desktop.clipPath, 'inset(0px 0px 0px 0px)', 'transparent minimap canvas must not clip the bloom halo')
  const slot = { left: 20, top: 72, width: 175, height: 144 }
  const mobile = exploreLayout({ width: 390, height: 844 }, { width: 390, height: 744, top: 0 }, undefined, undefined, slot)
  assert.equal(mobile.contextualMapVisible, true)
  assert.ok(mobile.x >= slot.left)
  assert.ok(mobile.y >= slot.top)
  assert.ok(mobile.x + 390 * mobile.scale <= slot.left + slot.width)
  assert.ok(mobile.y + 744 * mobile.scale <= slot.top + slot.height)
  // Orientation, not width, decides whether the portrait map slot is used.
  const narrowLandscapeViewport = { width: 640, height: 360 }
  const narrowLandscapeStage = { width: 640, height: 360, top: 0 }
  assert.deepEqual(
    exploreLayout(narrowLandscapeViewport, narrowLandscapeStage, content, undefined, slot),
    exploreLayout(narrowLandscapeViewport, narrowLandscapeStage, content),
  )
  const tabletPortrait = exploreLayout({ width: 900, height: 1200 }, { width: 900, height: 1200, top: 0 }, undefined, undefined, slot)
  assert.ok(tabletPortrait.x >= slot.left)
  assert.ok(tabletPortrait.x + 900 * tabletPortrait.scale <= slot.left + slot.width)
  assert.ok(tabletPortrait.y + 1200 * tabletPortrait.scale <= slot.top + slot.height)

  navigation.resetToOrchestra()
  console.log('Passed experience eligibility, independent mode/navigation state, playback preservation, rapid mode actions, and responsive map targets.')
}
