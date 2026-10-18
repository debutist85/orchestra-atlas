import assert from 'node:assert/strict'

export async function verifyCanvasGestures(server) {
  const { createCanvasGestures } = await server.ssrLoadModule('/src/features/instrument-explorer/scene/canvas-gestures.ts')

  const element = new EventTarget()
  const pointer = (type, pointerId, x, y) => Object.assign(new Event(type), { pointerId, clientX: x, clientY: y })
  const taps = []
  let clicks = 0
  let consume = false
  const dispose = createCanvasGestures(element, { onTap: event => { taps.push([event.clientX, event.clientY]); return consume }, onClick: () => { clicks++ } })
  const gesture = (steps) => { for (const step of steps) element.dispatchEvent(step); element.dispatchEvent(new Event('click')) }

  gesture([pointer('pointerdown', 1, 100, 100), pointer('pointerup', 1, 103, 102)])
  assert.deepEqual(taps, [[103, 102]], 'a short press is a tap')
  assert.equal(clicks, 1, 'an unconsumed tap reaches onClick')

  gesture([pointer('pointerdown', 1, 100, 100), pointer('pointerup', 1, 140, 100)])
  assert.equal(taps.length, 1, 'an orbit drag is not a tap')
  assert.equal(clicks, 1, 'nor does its trailing click count')

  gesture([pointer('pointerdown', 1, 100, 100), pointer('pointerdown', 2, 200, 200), pointer('pointerup', 2, 200, 200), pointer('pointerup', 1, 100, 100)])
  assert.equal(taps.length, 1, 'a pinch never counts as a tap, even if neither finger moved')
  assert.equal(clicks, 1)

  gesture([pointer('pointerdown', 1, 100, 100), pointer('pointercancel', 1, 100, 100)])
  assert.equal(clicks, 1, 'a cancelled gesture is not a tap')

  consume = true
  gesture([pointer('pointerdown', 1, 50, 50), pointer('pointerup', 1, 50, 50)])
  assert.equal(taps.length, 2, 'a consumed tap still reaches onTap')
  assert.equal(clicks, 1, 'a tap consumed by onTap (hotspot placement) does not also click')

  dispose()
  consume = false
  gesture([pointer('pointerdown', 1, 0, 0), pointer('pointerup', 1, 0, 0)])
  assert.equal(taps.length, 2, 'disposed listeners are gone')

  console.log('Passed canvas gestures: tap vs drag, pinch and cancel rejection, tap consumption, and disposal.')
}
