import { Eye, BookOpen } from 'lucide-react'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useAnatomyStore } from '../../store/anatomy-store'
import { anatomyLabel } from './instrument-anatomy'
import { techniquesForAnatomyPart, techniqueHasAudio, techniqueHasVideo } from './technique'
import { constellationLayout, constellationNodeSize, constellationConnection, type ConstellationProjection } from './contextual-constellation-layout'
import { ConstellationAudioNode } from './ConstellationAudioNode'

function updateConnection(line: SVGLineElement | undefined, hotspot: ConstellationProjection, center: { x: number; y: number }, radius: number) {
  if (!line) return
  // Match the marker's 35% dot inside its clamped 8vmin target.
  const hotspotRadius = Math.max(48, Math.min(96, Math.min(window.innerWidth, window.innerHeight) * 0.08)) * 0.35 / 2
  const segment = constellationConnection(hotspot, center, hotspotRadius + 1, radius + 1)
  line.setAttribute('x1', String(segment.start.x)); line.setAttribute('y1', String(segment.start.y))
  line.setAttribute('x2', String(segment.end.x)); line.setAttribute('y2', String(segment.end.y))
}

export function ContextualConstellation({ instrumentId, partId, performanceVisible = false, retainedNodeId = null }: { instrumentId: OrchestraInstrument; partId: string; performanceVisible?: boolean; retainedNodeId?: string | null }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const projectionRef = useRef<ConstellationProjection | null>(null)
  const entranceRef = useRef(false)
  const animationRef = useRef<gsap.core.Timeline | null>(null)
  const [ready, setReady] = useState(false)
  const readyRef = useRef(false)
  const discoveryOpen = useAnatomyStore(state => state.discoveryOpen)
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const techniques = techniquesForAnatomyPart(partId, instrumentId).filter(item => techniqueHasAudio(item) || techniqueHasVideo(item))
  const count = techniques.length + 1
  const playingId = useAnatomyStore(state => state.techniqueNoteId)
  const activeAudio = techniques.find(item => item.id === playingId)
  const activeAudioId = activeAudio?.id ?? null
  const activeNodeId = activeAudioId ?? (discoveryOpen ? 'discover' : retainedNodeId)
  const previousAudioRef = useRef<string | null>(null)
  const label = anatomyLabel(partId, instrumentId) ?? 'Anatomy'
  const showActions = ready && !demonstrationOpen && !performanceVisible

  useLayoutEffect(() => {
    const root = rootRef.current
    const explorer = root?.closest('.instrument-explore')
    if (!root || !explorer) return
    const position = (event: Event) => {
      const projection = (event as CustomEvent<ConstellationProjection>).detail
      root.style.setProperty('--context-node-size', `${constellationNodeSize(projection.view, { width: window.innerWidth, height: window.innerHeight }, count)}px`)
      const previous = projectionRef.current
      projectionRef.current = projection
      const nodes = root.querySelectorAll<HTMLElement>('.contextual-constellation__node')
      const lines = root.querySelectorAll<SVGLineElement>('line')
      const resized = previous && (previous.view.width !== projection.view.width || previous.view.height !== projection.view.height || previous.view.left !== projection.view.left)
      if (resized && animationRef.current?.isActive() && !projection.moving && projection.visible && !useAnatomyStore.getState().discoveryOpen) {
        // A resize must not leave moving controls outside the new safe area.
        animationRef.current.kill()
        gsap.set(nodes, { opacity: (index, node) => !activeNodeId || (activeNodeId === 'discover' ? index === 0 : node.dataset.techniqueId === activeNodeId) ? 1 : 0, scale: 1 })
        gsap.set(root.querySelectorAll('.contextual-constellation__label'), { opacity: 1 })
        gsap.set(lines, { opacity: index => !activeNodeId || (activeNodeId === 'discover' ? index === 0 : nodes[index]?.dataset.techniqueId === activeNodeId) ? 1 : 0 })
        const actions = root.querySelector<HTMLElement>('.contextual-constellation__actions')
        if (actions && !useAnatomyStore.getState().discoveryOpen) actions.inert = false
      }
      if (!animationRef.current?.isActive() || !entranceRef.current) {
        constellationLayout(projection, count, { width: window.innerWidth, height: window.innerHeight }).forEach((point, index) => {
          gsap.set(nodes[index], { x: point.x, y: point.y })
          updateConnection(lines[index], projection, point, constellationNodeSize(projection.view, { width: window.innerWidth, height: window.innerHeight }, count) / 2)
        })
      }
      const nextReady = projection.visible && !projection.moving
      if (nextReady !== readyRef.current) {
        readyRef.current = nextReady
        setReady(nextReady)
      }
    }
    explorer.addEventListener('instrument-hotspot-project', position)
    return () => explorer.removeEventListener('instrument-hotspot-project', position)
  }, [count, activeNodeId])

  useLayoutEffect(() => {
    const root = rootRef.current
    const projection = projectionRef.current
    if (!root) return
    animationRef.current?.kill()
    entranceRef.current = false
    const actions = root.querySelector<HTMLElement>('.contextual-constellation__actions')
    if (actions) actions.inert = true
    const nodes = root.querySelectorAll<HTMLElement>('.contextual-constellation__node')
    const labels = root.querySelectorAll('.contextual-constellation__label')
    const lines = root.querySelectorAll<SVGLineElement>('line')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeline = gsap.timeline()
    animationRef.current = timeline
    const restoringAudio = previousAudioRef.current !== null && activeNodeId === null
    previousAudioRef.current = activeNodeId
    if (showActions && activeNodeId) {
      nodes.forEach((node, index) => {
        const visible = activeNodeId === 'discover' ? index === 0 : node.dataset.techniqueId === activeNodeId
        timeline.to([node, lines[index]], { opacity: visible ? 1 : 0, duration: reduced ? 0 : 0.18 }, 0)
      })
      if (actions) actions.inert = false
    } else if (showActions && restoringAudio) {
      timeline.to([nodes, labels, lines], { opacity: 1, duration: reduced ? 0 : 0.2 }, 0)
      if (actions) actions.inert = false
    } else if (showActions && projection) {
      entranceRef.current = true
      const points = constellationLayout(projection, count, { width: window.innerWidth, height: window.innerHeight })
      gsap.set(labels, { opacity: 0 })
      nodes.forEach((node, index) => {
        const line = lines[index]
        gsap.set(line, { attr: { x1: projection.x, y1: projection.y, x2: projection.x, y2: projection.y }, opacity: 0 })
        timeline.fromTo(node, { x: projection.x, y: projection.y, scale: reduced ? 1 : 0.2, opacity: 0 }, {
          x: points[index].x, y: points[index].y, scale: 1, opacity: 1,
          duration: reduced ? 0 : 0.4, ease: 'power3.out',
          onUpdate: () => {
            const scale = Number(gsap.getProperty(node, 'scale'))
            const center = { x: Number(gsap.getProperty(node, 'x')), y: Number(gsap.getProperty(node, 'y')) + 16 * (1 - scale) }
            const radius = constellationNodeSize(projection.view, { width: window.innerWidth, height: window.innerHeight }, count) / 2 * scale
            updateConnection(line, projection, center, radius)
          },
        }, reduced ? 0 : index * 0.025)
        timeline.to(line, { opacity: 1, duration: reduced ? 0 : 0.25 }, reduced ? 0 : 0.08 + index * 0.025)
      })
      timeline.to(labels, { opacity: 1, duration: reduced ? 0 : 0.12 }, reduced ? 0 : 0.37)
      timeline.call(() => {
        entranceRef.current = false
        if (actions) actions.inert = false
        root.querySelector<HTMLButtonElement>('.contextual-constellation__node button')?.focus({ preventScroll: true })
      })
    } else {
      timeline.to([nodes, labels, lines], { opacity: 0, duration: reduced ? 0 : 0.18 }, 0)
    }
    return () => { timeline.kill() }
  }, [showActions, count, activeAudioId, activeNodeId])

  return <div ref={rootRef} className="contextual-constellation" aria-label={`${label} discoveries`}>
    <div className="contextual-constellation__actions" inert={!showActions} aria-hidden={!showActions}>
      <svg className="contextual-constellation__lines" aria-hidden="true">{Array.from({ length: count }, (_, index) => <line key={index} data-selected={(index === 0 ? activeNodeId === 'discover' : techniques[index - 1]?.id === activeNodeId) ? 'true' : undefined} />)}</svg>
      <div className="contextual-constellation__node" data-selected={activeNodeId === 'discover' ? 'true' : undefined} inert={!!activeNodeId && activeNodeId !== 'discover'} aria-hidden={!!activeNodeId && activeNodeId !== 'discover'}><button type="button" className="contextual-constellation__action" aria-label={`Discover ${label}`} aria-pressed={discoveryOpen} onClick={() => useAnatomyStore.getState().openDiscovery()}>
        <span className="contextual-constellation__circle" aria-hidden="true"><BookOpen size={20} strokeWidth={1.5} /></span><span className="contextual-constellation__label">Discover</span>
      </button></div>
      {techniques.map(item => <div key={item.id} data-technique-id={item.id} data-selected={activeNodeId === item.id ? 'true' : undefined} className="contextual-constellation__node" inert={!!activeNodeId && activeNodeId !== item.id} aria-hidden={!!activeNodeId && activeNodeId !== item.id}>
        {techniqueHasAudio(item) ? <ConstellationAudioNode technique={item} /> : <button type="button" className="contextual-constellation__action" aria-label={`Watch ${item.title}, placeholder video`} onClick={() => useAnatomyStore.getState().openPerformance(item.id, instrumentId)}>
          <span className="contextual-constellation__circle" aria-hidden="true"><Eye size={20} strokeWidth={1.5} /></span><span className="contextual-constellation__label">{item.title}</span>
        </button>}
      </div>)}
    </div>
    {techniques.some(techniqueHasAudio) && <span className="sr-only">Audio uses a shared violin chords placeholder, not a verified example of each technique.</span>}
  </div>
}
