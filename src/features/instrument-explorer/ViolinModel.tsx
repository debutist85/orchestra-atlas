import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import { instantiateInstrumentModel } from './instrument-model-resource'

type Props = {
  url: string
  onReady: () => void
  onError: () => void
}

export function ViolinModel({ url, onReady, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.domElement.setAttribute('aria-hidden', 'true')
    host.append(renderer.domElement)
    scene.add(new THREE.HemisphereLight(0xf1eadb, 0x171b22, 2.2))
    const key = new THREE.DirectionalLight(0xffe3bd, 3.5)
    key.position.set(4, 6, 5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x8ea9d8, 2.2)
    rim.position.set(-4, 1, -3)
    scene.add(rim)

    let model: THREE.Object3D | undefined
    let ready = false
    const render = () => renderer.render(scene, camera)
    const resize = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      render()
      if (model && !ready) {
        ready = true
        onReady()
      }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    void instantiateInstrumentModel(url).then(loadedModel => {
      if (disposed) return
      model = loadedModel
      // The asset lies on its side in its authored pose. Rotate its front plane
      // square to the camera without adding a perspective turn around Y or Z.
      model.rotation.set(Math.PI / 2, 0, 0)
      model.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      model.position.sub(center)
      scene.add(model)
      const radius = Math.max(size.x, size.y, size.z) * 0.5
      const distance = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * 1.3
      camera.position.set(0, 0, Math.max(distance, 0.5))
      camera.lookAt(0, 0, 0)
      setStatus('ready')
      resize()
    }).catch(() => {
      if (!disposed) {
        setStatus('error')
        onError()
      }
    })

    return () => {
      disposed = true
      observer.disconnect()
      model?.removeFromParent()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [onError, onReady, url])

  return <div ref={hostRef} className="instrument-explore__model-canvas">
    {status === 'loading' && <output className="instrument-explore__status">Loading violin model</output>}
    {status === 'error' && <p className="instrument-explore__status" role="alert">Violin model unavailable</p>}
  </div>
}
