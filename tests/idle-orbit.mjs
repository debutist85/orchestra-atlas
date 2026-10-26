import assert from 'node:assert/strict'

// The rotation affordance's sway: a slow sine of a few degrees about the
// vertical axis, eased in from rest so it never starts with a jolt.
export async function verifyIdleOrbit(server) {
  const { idleOrbitOffset, rotationDiscovered, markRotationDiscovered } = await server.ssrLoadModule('/src/features/instrument-explorer/scene/idle-orbit.ts')
  const { instrumentExplorerConfig } = await server.ssrLoadModule('/src/features/instrument-explorer/config.ts')
  const settings = instrumentExplorerConfig.idleOrbit
  const degrees = radians => radians * 180 / Math.PI

  assert.ok(settings.amplitudeDeg >= 3 && settings.amplitudeDeg <= 5, 'a few degrees either way')
  assert.ok(settings.periodSeconds >= 7 && settings.periodSeconds <= 10, 'a slow cycle')
  assert.equal(idleOrbitOffset(0, settings), 0, 'starts at the resting pose')
  // Eased in: the first step is far smaller than an un-eased sine's.
  const early = idleOrbitOffset(0.1, settings)
  const raw = settings.amplitudeDeg * Math.PI / 180 * Math.sin(0.1 / settings.periodSeconds * Math.PI * 2)
  assert.ok(Math.abs(early) < Math.abs(raw) * 0.05, 'no jolt at the start')
  // After the ramp, the full amplitude, never beyond it.
  let peak = 0
  for (let t = 0; t < settings.periodSeconds * 3; t += 0.01) peak = Math.max(peak, Math.abs(degrees(idleOrbitOffset(t, settings))))
  assert.ok(peak <= settings.amplitudeDeg + 1e-9 && peak > settings.amplitudeDeg * 0.99, 'reaches but never exceeds the amplitude')
  // Periodic once eased in.
  const t = settings.rampSeconds + 1.3
  assert.ok(Math.abs(idleOrbitOffset(t, settings) - idleOrbitOffset(t + settings.periodSeconds, settings)) < 1e-9)

  assert.equal(rotationDiscovered(), false)
  markRotationDiscovered()
  assert.equal(rotationDiscovered(), true, 'one turn of any instrument retires the affordance on all of them for the session')
  markRotationDiscovered()
  assert.equal(rotationDiscovered(), true)
}
