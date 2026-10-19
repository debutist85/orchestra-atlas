import type { OrchestraInstrument } from '../../orchestra-map/config'
import type { InstrumentViewOrientation } from '../instrument-view'

// Typography as objects at different depths around the instrument, not as
// fixed overlay UI. Each piece of text belongs to a plane; a plane has a
// depth relative to the instrument and moves with a damped parallax derived
// from the instrument camera's orbit. The text itself stays semantic HTML —
// planes are a positioning concept with no visible container.

// Later stages add 'anatomy' and 'technique' planes for the zoomed views.
export type SpatialPlaneId = 'family' | 'instrument'
export type SpatialTextId = 'familyTitle' | 'instrumentTitle'

// In the full-instrument view the labels never overlap the model's box, so
// hotspots stay uncovered: they get their own side of the stage and the
// model is framed into what remains. The side depends only on the stage,
// never on the instrument: on a landscape stage the title is right of the
// model (and the description left of it); on a portrait stage (a phone held
// upright) labels go on top — beside the model there is too little width
// to read.
export type LabelSide = 'right' | 'top'

export type PlaneAlign = 'start' | 'center' | 'end'

// A point relative to a reference box: the model's on-screen bounds in the
// front view; with `relativeTo: 'labels'`, the labels' own side of the stage
// (e.g. flush with its right edge); or with a plane id, another plane's
// placed box, for text that belongs together (the family title sitting on
// the instrument title).
// [0, 0] is the box's top-left, [1, 1] its bottom-right, and values outside
// 0..1 sit beside it. The plane's `alignX`/`alignY` edge (or center) is
// placed at that point (plus `offset`, px), so a plane grows away from its
// reference — e.g. a bottom-aligned plane grows upward as its text wraps.
// Text alignment follows `alignX`. Planes linked by `relativeTo` are kept on
// screen as one group, so they never slide over each other. Wherever the
// position points, a plane is confined to its label side of the stage.
export type SpatialPlanePosition = {
  relativeTo?: SpatialPlaneId | 'labels'
  anchor: readonly [number, number]
  offset?: readonly [number, number]
  alignX: PlaneAlign
  alignY: PlaneAlign
}

// One position per label side, since where text sits relative to the model
// depends on which side of it the labels are on.
export type SidePlanePositions = Record<LabelSide, SpatialPlanePosition>

export type SpatialPlaneConfig = {
  // Signed distance from the instrument's own plane, in arbitrary units:
  // > 0 sits between the instrument and the viewer, < 0 behind it. The sign
  // sets the parallax direction — the camera orbits the instrument, so
  // planes on opposite sides of it slide in opposite directions — and the
  // magnitude sets stacking order. Strength is set separately below so each
  // plane can be tuned without re-deriving the others.
  depth: number
  // Default for every instrument; see instrumentPlanePositions for overrides.
  position: SidePlanePositions
  // Maximum displacement in px at the reference viewport width, reached
  // when the camera has orbited 90° from the front view (x) or to its
  // steepest permitted elevation (y).
  parallax: { x: number; y: number }
  opacity: number
  scale: number
  // px; a light defocus that sells distance. Keep small — this is text.
  blur?: number
}

export type SpatialTextConfig = {
  plane: SpatialPlaneId
  // Fraction of the plane's parallax this text follows. Body copy moves
  // less than its title so it stays comfortable to read mid-rotation.
  motion: number
}

export type SpatialTypographyConfig = {
  parallaxReferenceWidth: number
  parallaxMinScale: number
  // Exponential approach rate (1/s) toward the camera-derived offset.
  // Layered on top of OrbitControls' own damping to remove the remaining
  // per-frame jitter of a raw pointer drag.
  damping: number
  // Safety margin (px) kept clear inside the viewport's safe area and
  // between the header and footer bars, whatever a plane's position asks
  // for. Each plane's parallax reach is reserved on top of it, so text stays
  // inside even mid-rotation.
  edgeMargin: number
  // The model frame's own margin (px) inside the same safe area — smaller
  // than the labels', so on a short screen the model can use nearly all the
  // height between the header and footer bars.
  modelEdgeMargin: number
  // A plane narrower than this (px) would wrap too hard to read; below it,
  // the plane keeps this width and shifts instead.
  minPlaneWidth: number
  // Clearance (px) kept between the contextual minimap and labels on top /
  // the model frame below it.
  minimapGap: number
  // When the titles travel with a hotspot zoom, each plane is placed this
  // fraction of the camera-to-model depth nearer the camera per unit of its
  // `depth` (negative: further), so the foreground title rushes past faster
  // than the family title behind it.
  travelDepthSpacing: number
  // Most of the area (fraction, along the label side's axis) the labels may
  // claim; the model always keeps the rest.
  maxLabelShare: Record<LabelSide, number>
  // Front-view width/height used to compose the stage for an instrument
  // without a 3D model yet (or before the model has been measured).
  placeholderModelAspect: number
  planes: Record<SpatialPlaneId, SpatialPlaneConfig>
  // Per-instrument position overrides, by plane. Anything not listed uses
  // the plane's default position.
  instrumentPlanePositions: Partial<Record<OrchestraInstrument, Partial<Record<SpatialPlaneId, Partial<SidePlanePositions>>>>>
  text: Record<SpatialTextId, SpatialTextConfig>
}

export const spatialTypographyConfig: SpatialTypographyConfig = {
  parallaxReferenceWidth: 1440,
  parallaxMinScale: 0.45,
  damping: 7,
  edgeMargin: 16,
  modelEdgeMargin: 4,
  minPlaneWidth: 200,
  minimapGap: 16,
  travelDepthSpacing: 0.12,
  maxLabelShare: { right: 0.45, top: 0.45 },
  placeholderModelAspect: 0.45,
  planes: {
    // Behind the instrument: smaller, fainter, slightly soft, and drifting
    // against the foreground as the instrument turns.
    family: {
      depth: -1,
      position: {
        // Sits on the instrument title — slightly indented beside the
        // model, centered above it.
        right: { relativeTo: 'instrument', anchor: [0, 0], offset: [12, -6], alignX: 'start', alignY: 'end' },
        top: { relativeTo: 'instrument', anchor: [1, 0], offset: [0, -6], alignX: 'end', alignY: 'end' },
      },
      parallax: { x: 10, y: 4 },
      opacity: 0.4,
      scale: 0.94,
      blur: 0.4,
    },
    // In front of the instrument and visually dominant.
    instrument: {
      depth: 1,
      position: {
        // Right of the model, vertically centered on it. The gap from the
        // model is per instrument (explorerLayout gaps, withModelGap).
        right: { anchor: [1, 0.5], offset: [0, 0], alignX: 'start', alignY: 'center' },
        // Above the model, right-aligned to the stage edge (the minimap
        // holds the top-left), growing upward from the labels' bottom edge,
        // which sits on the model's box; the gap is per instrument too.
        top: { relativeTo: 'labels', anchor: [1, 1], offset: [0, 0], alignX: 'end', alignY: 'end' },
      },
      parallax: { x: 24, y: 9 },
      opacity: 1,
      scale: 1,
    },
  },
  // e.g. violin: { instrument: { right: { anchor: [1, 0.4], ... } } }
  instrumentPlanePositions: {},
  text: {
    familyTitle: { plane: 'family', motion: 1 },
    instrumentTitle: { plane: 'instrument', motion: 1 },
  },
}

export function labelSideFor(stageOrientation: 'portrait' | 'landscape'): LabelSide {
  return stageOrientation === 'portrait' ? 'top' : 'right'
}

// Moves a plane that faces the model `gap` px away from it: beside the
// model, a plane placed against the model's bounds; above it, a plane
// placed on the labels' bottom edge (which meets the model's box). Planes
// placed against another plane follow that plane instead.
export function withModelGap(position: SpatialPlanePosition, side: LabelSide, gap: number): SpatialPlanePosition {
  const [x, y] = position.offset ?? [0, 0]
  if (side === 'right' && !position.relativeTo) return { ...position, offset: [x + gap, y] }
  if (side === 'top' && position.relativeTo === 'labels' && position.anchor[1] === 1) return { ...position, offset: [x, y - gap] }
  return position
}

export function planePosition(
  planeId: SpatialPlaneId,
  side: LabelSide,
  instrumentId?: OrchestraInstrument,
  config: SpatialTypographyConfig = spatialTypographyConfig,
): SpatialPlanePosition {
  return (instrumentId && config.instrumentPlanePositions[instrumentId]?.[planeId]?.[side]) || config.planes[planeId].position[side]
}

export type PlaneBox = { left: number; top: number; width: number; height: number }
export type LayoutArea = { left: number; top: number; right: number; bottom: number }
export type PlaneSize = { width: number; height: number }
export type PlaneLayoutInput = {
  id: SpatialPlaneId
  position: SpatialPlanePosition
  // How far (px) this plane's text can travel from its rest position; kept
  // clear of the area edges on top of the edge margin.
  reach: { x: number; y: number }
  // Lays the plane out at (at most) `maxWidth` and returns its size.
  measure: (maxWidth: number) => PlaneSize
}
export type PlaneLayout = {
  points: Partial<Record<SpatialPlaneId, { x: number; y: number }>>
  boxes: Partial<Record<SpatialPlaneId, PlaneBox>>
}

export const alignFactor = (align: PlaneAlign) => align === 'start' ? 0 : align === 'center' ? 0.5 : 1

// Stage-px point where the plane's aligned edge (or center) goes.
export function planeAnchorPoint(position: SpatialPlanePosition, reference: PlaneBox) {
  return {
    x: reference.left + reference.width * position.anchor[0] + (position.offset?.[0] ?? 0),
    y: reference.top + reference.height * position.anchor[1] + (position.offset?.[1] ?? 0),
  }
}

const insetArea = (area: LayoutArea, reach: { x: number; y: number }): LayoutArea => ({
  left: area.left + reach.x, top: area.top + reach.y, right: area.right - reach.x, bottom: area.bottom - reach.y,
})

// Width a plane may take from its anchor point to the edge(s) of its area —
// so text wraps where it stands instead of being pushed sideways — but never
// less than `minWidth` (then containment shifts it) nor more than the area.
export function availablePlaneWidth(point: { x: number }, alignX: PlaneAlign, area: LayoutArea, minWidth: number) {
  const areaWidth = Math.max(0, area.right - area.left)
  const toEdge = alignX === 'start' ? area.right - point.x
    : alignX === 'end' ? point.x - area.left
      : 2 * Math.min(point.x - area.left, area.right - point.x)
  return Math.min(areaWidth, Math.max(Math.min(minWidth, areaWidth), toEdge))
}

// The shift closest to zero that keeps every [box, area] pair inside its
// area. When no shift satisfies all of them, the start edge (left/top) wins,
// so whatever overflows does so toward the end edge.
function groupShift(pairs: { start: number; end: number; min: number; max: number }[]) {
  const low = Math.max(...pairs.map(pair => pair.min - pair.start))
  const high = Math.min(...pairs.map(pair => pair.max - pair.end))
  return low > high ? low : Math.min(high, Math.max(low, 0))
}

// Places every plane, resolving `relativeTo` chains, capping each plane's
// width to the space it has, then keeps each linked group inside the area
// (each plane's area inset by its own parallax reach) with one shared
// shift. A plane `relativeTo` that is missing or would form a cycle falls
// back to the model bounds.
export function layoutPlanes(inputs: PlaneLayoutInput[], modelBounds: PlaneBox, area: LayoutArea, minWidth: number): PlaneLayout {
  const byId = new Map(inputs.map(input => [input.id, input]))
  const placedBoxes = new Map<SpatialPlaneId, PlaneBox>()
  const roots = new Map<SpatialPlaneId, SpatialPlaneId>()
  const areaOf = (id: SpatialPlaneId) => insetArea(area, byId.get(id)!.reach)

  const place = (id: SpatialPlaneId, visiting: ReadonlySet<SpatialPlaneId>): PlaneBox | undefined => {
    const placed = placedBoxes.get(id)
    if (placed) return placed
    const input = byId.get(id)
    if (!input) return undefined
    const reference = input.position.relativeTo
    const parentId = reference === 'labels' ? undefined : reference
    const parent = parentId && !visiting.has(parentId) ? place(parentId, new Set([...visiting, id])) : undefined
    roots.set(id, parent && parentId ? roots.get(parentId)! : id)
    const areaBox = { left: area.left, top: area.top, width: area.right - area.left, height: area.bottom - area.top }
    const point = planeAnchorPoint(input.position, parent ?? (reference === 'labels' ? areaBox : modelBounds))
    const { width, height } = input.measure(availablePlaneWidth(point, input.position.alignX, areaOf(id), minWidth))
    const box = {
      left: point.x - width * alignFactor(input.position.alignX),
      top: point.y - height * alignFactor(input.position.alignY),
      width,
      height,
    }
    placedBoxes.set(id, box)
    return box
  }
  for (const input of inputs) place(input.id, new Set())

  const grouped = new Map<SpatialPlaneId, SpatialPlaneId[]>()
  for (const [id, root] of roots) grouped.set(root, [...(grouped.get(root) ?? []), id])
  const points: PlaneLayout['points'] = {}
  const boxes: PlaneLayout['boxes'] = {}
  for (const members of grouped.values()) {
    const placed = members.map(id => ({ id, box: placedBoxes.get(id)!, area: areaOf(id) }))
    const shift = {
      x: groupShift(placed.map(({ box, area }) => ({ start: box.left, end: box.left + box.width, min: area.left, max: area.right }))),
      y: groupShift(placed.map(({ box, area }) => ({ start: box.top, end: box.top + box.height, min: area.top, max: area.bottom }))),
    }
    for (const { id, box } of placed) {
      const { alignX, alignY } = byId.get(id)!.position
      const shifted = { ...box, left: box.left + shift.x, top: box.top + shift.y }
      boxes[id] = shifted
      points[id] = {
        x: shifted.left + shifted.width * alignFactor(alignX),
        y: shifted.top + shifted.height * alignFactor(alignY),
      }
    }
  }
  return { points, boxes }
}

// How much of the area (px, along the label side's axis) the labels need:
// the group laid out against the edge of a stand-in model at the most room
// it may claim, plus its parallax reach. Independent of the real model
// bounds, so framing the model to it can't feed back into it.
export function measureLabelSpace(inputs: PlaneLayoutInput[], area: LayoutArea, side: LabelSide, maxShare: number, minWidth: number) {
  const width = area.right - area.left
  const height = area.bottom - area.top
  if (side === 'right') {
    const limit = width * maxShare
    const layout = layoutPlanes(inputs, { left: area.left, top: area.top, width: 0, height }, { ...area, right: area.left + limit }, minWidth)
    const extent = Math.max(0, ...inputs.map(input => {
      const box = layout.boxes[input.id]
      return box ? box.left + box.width + input.reach.x - area.left : 0
    }))
    return Math.min(limit, extent)
  }
  const limit = height * maxShare
  const layout = layoutPlanes(inputs, { left: area.left, top: area.bottom, width, height: 0 }, { ...area, top: area.bottom - limit }, minWidth)
  const extent = Math.max(0, ...inputs.map(input => {
    const box = layout.boxes[input.id]
    return box ? area.bottom - (box.top - input.reach.y) : 0
  }))
  return Math.min(limit, extent)
}

// Splits the area into the model's frame and the labels' side. The model
// frame matches the model's own front-view aspect — narrowed beside labels
// on the right, shortened below labels on top — and
// model + labels are centered together as one composition.
export function composeInstrumentFrame(area: LayoutArea, side: LabelSide, labelSpace: number, modelAspect: number) {
  const width = Math.max(1, area.right - area.left)
  const height = Math.max(1, area.bottom - area.top)
  const aspect = modelAspect > 0 ? modelAspect : 1
  if (side === 'right') {
    const frameHeight = Math.min(height, Math.max(1, width - labelSpace) / aspect)
    const frameWidth = frameHeight * aspect
    const left = area.left + (width - frameWidth - labelSpace) / 2
    const model = roundBox({ left, top: area.top + (height - frameHeight) / 2, width: frameWidth, height: frameHeight })
    return { model, labels: { left: model.left + model.width, top: area.top, right: area.right, bottom: area.bottom } }
  }
  const frameWidth = Math.min(width, Math.max(1, height - labelSpace) * aspect)
  const frameHeight = frameWidth / aspect
  const top = area.top + (height - frameHeight - labelSpace) / 2 + labelSpace
  const model = roundBox({ left: area.left + (width - frameWidth) / 2, top, width: frameWidth, height: frameHeight })
  return { model, labels: { left: area.left, top: area.top, right: area.right, bottom: model.top } }
}

// The minimap holds the top-left corner. With labels on top (a portrait
// stage) the title may use the stage's full width, minimap or not — on a
// narrow screen that width matters more than clearing the minimap — while
// the model frame still starts below it. (Labels on the right: see
// composeStage.)
export function labelAreaAround(area: LayoutArea, side: LabelSide, minimap: PlaneBox | undefined, gap: number) {
  if (side !== 'top' || !minimap) return { labelArea: area, minLabelSpace: 0 }
  return {
    labelArea: area,
    minLabelSpace: Math.max(0, minimap.top + minimap.height + gap - area.top),
  }
}

const overlaps = (a: PlaneBox, b: PlaneBox, gap: number) =>
  a.left < b.left + b.width + gap && b.left < a.left + a.width + gap
  && a.top < b.top + b.height + gap && b.top < a.top + a.height + gap

// Measures the labels and splits the area into model frame and label side,
// keeping both clear of the minimap. Labels on top start beside it and the
// model below it; with labels on the right, the centered composition is
// moved clear of it only when the model frame would otherwise run under it.
//
// `labelArea` and `modelArea` are the same safe area inset by the labels' and
// the model's own margins (the model's is smaller). The label space is
// measured in the label area and widened by the difference in margin on the
// labels' side, so the split happens in the model area's terms.
export function composeStage(
  inputs: PlaneLayoutInput[],
  labelArea: LayoutArea,
  modelArea: LayoutArea,
  side: LabelSide,
  modelAspect: number,
  minimap: PlaneBox | undefined,
  config: SpatialTypographyConfig = spatialTypographyConfig,
) {
  const compose = (labelBounds: LayoutArea, modelBounds: LayoutArea) => {
    const around = labelAreaAround(labelBounds, side, minimap, config.minimapGap)
    const measured = Math.max(around.minLabelSpace, measureLabelSpace(inputs, around.labelArea, side, config.maxLabelShare[side], config.minPlaneWidth))
    const marginDifference = side === 'right' ? modelBounds.right - labelBounds.right : labelBounds.top - modelBounds.top
    const { model, labels } = composeInstrumentFrame(modelBounds, side, measured + marginDifference, modelAspect)
    return {
      model,
      labels: {
        left: Math.max(labels.left, around.labelArea.left),
        top: Math.max(labels.top, around.labelArea.top),
        right: Math.min(labels.right, around.labelArea.right),
        bottom: Math.min(labels.bottom, around.labelArea.bottom),
      },
    }
  }
  const composed = compose(labelArea, modelArea)
  if (side !== 'right' || !minimap || !overlaps(composed.model, minimap, config.minimapGap)) return composed
  const clear = minimap.left + minimap.width + config.minimapGap
  return compose({ ...labelArea, left: Math.min(labelArea.right, clear) }, { ...modelArea, left: Math.min(modelArea.right, clear) })
}

// Whole px, so recomposing at an unchanged size yields an identical frame
// and the model isn't re-framed for float noise.
const roundBox = (box: PlaneBox): PlaneBox => ({
  left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height),
})

// The reach a plane's text can travel at this stage width.
export function planeReach(planeId: SpatialPlaneId, stageWidth: number, config: SpatialTypographyConfig = spatialTypographyConfig) {
  const { parallax } = config.planes[planeId]
  const scale = parallaxScale(stageWidth, config)
  return { x: parallax.x * scale, y: parallax.y * scale }
}

export function parallaxScale(stageWidth: number, config: SpatialTypographyConfig = spatialTypographyConfig) {
  return Math.min(1, Math.max(config.parallaxMinScale, stageWidth / config.parallaxReferenceWidth))
}

// Where the camera orbit puts a plane, as -1..1 per axis, before strength.
// Bounded and continuous through a full turn (sin of the angle), so free
// rotation never flings text off-screen or snaps at the ±π wrap. Derivation:
// for a camera orbiting the origin, a point in front of the origin shifts
// against the camera's sideways motion on screen, and down (CSS +y) as the
// camera rises; a point behind it does the opposite.
export function orbitDeflection(view: InstrumentViewOrientation) {
  const elevation = Math.PI / 2 - view.polar
  return { x: -Math.sin(view.azimuth), y: Math.sin(elevation) }
}

export function spatialTextOffset(
  textId: SpatialTextId,
  deflection: { x: number; y: number },
  scale: number,
  config: SpatialTypographyConfig = spatialTypographyConfig,
) {
  const text = config.text[textId]
  const plane = config.planes[text.plane]
  const direction = Math.sign(plane.depth)
  const strength = text.motion * scale * direction
  return { x: deflection.x * plane.parallax.x * strength, y: deflection.y * plane.parallax.y * strength }
}

// Frame-rate independent exponential smoothing step.
export function dampTowards(current: number, target: number, rate: number, dtSeconds: number) {
  return target + (current - target) * Math.exp(-rate * dtSeconds)
}
