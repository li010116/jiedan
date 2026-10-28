'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * Drop-in, transparent Three.js hero visual for the RIGHT-HAND AREA ONLY.
 * This component does not render a navbar, headings, buttons or a page background.
 * A parent container must supply its own explicit height.
 */
export type MoguHero3DProps = {
  accent?: string
  autoMotion?: boolean
  mouseParallax?: boolean
  maxPixelRatio?: number
}

const SCULPTURE_POINTS = [
  new THREE.Vector2(-1.45, -1.06),
  new THREE.Vector2(-1.45, 1.13),
  new THREE.Vector2(0, -0.34),
  new THREE.Vector2(1.45, 1.13),
  new THREE.Vector2(1.45, -1.06),
]

/** Build a closed, non-self-intersecting polygon around a centreline. */
function createStrokeShape(points: THREE.Vector2[], width: number): THREE.Shape {
  const half = width / 2
  const normals: THREE.Vector2[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const direction = points[i + 1].clone().sub(points[i]).normalize()
    normals.push(new THREE.Vector2(-direction.y, direction.x))
  }

  const offsets = points.map((_, i) => {
    if (i === 0) return normals[0].clone().multiplyScalar(half)
    if (i === points.length - 1) return normals[normals.length - 1].clone().multiplyScalar(half)
    const bisector = normals[i - 1].clone().add(normals[i]).normalize()
    const dot = Math.max(0.25, bisector.dot(normals[i]))
    return bisector.multiplyScalar(Math.min(half / dot, half * 2.35))
  })

  const left = points.map((point, i) => point.clone().add(offsets[i]))
  const right = points.map((point, i) => point.clone().sub(offsets[i])).reverse()
  const shape = new THREE.Shape()
  shape.moveTo(left[0].x, left[0].y)
  for (let i = 1; i < left.length; i++) shape.lineTo(left[i].x, left[i].y)
  right.forEach(point => shape.lineTo(point.x, point.y))
  shape.closePath()
  return shape
}

export default function MoguHero3D({
  accent = '#D4FF56',
  autoMotion = true,
  mouseParallax = true,
  maxPixelRatio = 1.8,
}: MoguHero3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [fallbackVisible, setFallbackVisible] = useState(true)

  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof window === 'undefined') return

    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let sculpture: THREE.Group | null = null
    let orbit: THREE.Group | null = null
    let node: THREE.Mesh | null = null
    let resizeObserver: ResizeObserver | null = null
    let intersectionObserver: IntersectionObserver | null = null
    let disposed = false
    let contextLost = false
    let intersecting = true
    let reducedMotion = false
    let elapsed = 0
    let previousTime = 0
    const pointer = new THREE.Vector2()
    const smoothedPointer = new THREE.Vector2()
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    reducedMotion = media?.matches ?? false

    function renderFrame(deltaSeconds: number) {
      if (!renderer || !scene || !camera || !sculpture || !orbit || contextLost || disposed) return
      const delta = Math.min(deltaSeconds, 0.05)
      elapsed += delta
      const active = autoMotion && !reducedMotion
      const t = active ? elapsed : 0
      const smoothing = 1 - Math.exp(-5.5 * (delta || 0.016))
      smoothedPointer.lerp(pointer, smoothing)

      sculpture.position.y = active ? Math.sin(t * 0.62) * 0.065 : 0
      sculpture.rotation.y = 0.08 + (active ? Math.sin(t * 0.35) * 0.06 : 0)
        + (mouseParallax && !reducedMotion ? smoothedPointer.x * 0.11 : 0)
      sculpture.rotation.x = -0.07
        + (mouseParallax && !reducedMotion ? -smoothedPointer.y * 0.075 : 0)
      sculpture.rotation.z = active ? Math.sin(t * 0.25) * 0.014 : 0
      orbit.rotation.z = active ? Math.sin(t * 0.24) * 0.045 : 0
      if (node) node.scale.setScalar(active ? 1 + Math.sin(t * 1.25) * 0.08 : 1)
      renderer.render(scene, camera)
    }

    function tick(timeMs: number) {
      const delta = previousTime ? (timeMs - previousTime) / 1000 : 0.016
      previousTime = timeMs
      renderFrame(delta)
    }

    function updateLoop() {
      if (!renderer || contextLost || disposed) return
      const shouldAnimate = autoMotion && !reducedMotion && intersecting && !document.hidden
      renderer.setAnimationLoop(shouldAnimate ? tick : null)
      previousTime = 0
      if (!shouldAnimate && !document.hidden && intersecting) renderFrame(0)
    }

    function resize() {
      if (!renderer || !camera || contextLost || disposed) return
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)
      camera.aspect = width / height
      // Zoom out for narrow columns/mobile, keep the artwork within the right container.
      camera.position.z = width < 500 ? 8.1 : 6.9
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Math.max(1, maxPixelRatio)))
      renderer.setSize(width, height, false)
      renderFrame(0)
    }

    function onPointerMove(event: PointerEvent) {
      if (!mouseParallax || reducedMotion || !host.clientWidth || !host.clientHeight) return
      const bounds = host.getBoundingClientRect()
      pointer.set(
        THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, -1, 1),
        THREE.MathUtils.clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 2, -1, 1),
      )
      if (!autoMotion) {
        smoothedPointer.copy(pointer)
        renderFrame(0)
      }
    }

    function onPointerLeave() {
      pointer.set(0, 0)
      if (!autoMotion) {
        smoothedPointer.set(0, 0)
        renderFrame(0)
      }
    }

    function onMotionChange(event: MediaQueryListEvent) {
      reducedMotion = event.matches
      if (reducedMotion) {
        pointer.set(0, 0)
        smoothedPointer.set(0, 0)
      }
      updateLoop()
    }

    function onContextLost(event: Event) {
      event.preventDefault()
      contextLost = true
      renderer?.setAnimationLoop(null)
      if (!disposed) setFallbackVisible(true)
    }

    function onContextRestored() {
      contextLost = false
      resize()
      if (!disposed) setFallbackVisible(false)
      updateLoop()
    }

    host.addEventListener('pointermove', onPointerMove, { passive: true })
    host.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', updateLoop)
    media?.addEventListener('change', onMotionChange)

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.3
      const canvas = renderer.domElement
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.display = 'block'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.pointerEvents = 'none'
      canvas.setAttribute('aria-hidden', 'true')
      canvas.addEventListener('webglcontextlost', onContextLost)
      canvas.addEventListener('webglcontextrestored', onContextRestored)
      host.appendChild(canvas)

      scene = new THREE.Scene() // transparency preserves the existing webpage's backdrop
      camera = new THREE.PerspectiveCamera(33, 1, 0.1, 60)
      camera.position.set(0.1, 0.15, 6.9)
      camera.lookAt(0, 0, 0)

      scene.add(new THREE.HemisphereLight(0xe8f1fa, 0x242525, 2.4))
      const key = new THREE.DirectionalLight(0xffffff, 3.1)
      key.position.set(-3, 4, 6)
      scene.add(key)
      const rim = new THREE.DirectionalLight(0xa4aab7, 2.2)
      rim.position.set(4, -1.2, -3)
      scene.add(rim)
      const fill = new THREE.PointLight(0xdbe1e0, 15, 14, 2)
      fill.position.set(1.5, 1.2, 4.5)
      scene.add(fill)

      sculpture = new THREE.Group()
      scene.add(sculpture)
      const shape = createStrokeShape(SCULPTURE_POINTS, 0.38)
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.33,
        steps: 1,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.025,
        bevelSegments: 2,
        curveSegments: 1,
      })
      geometry.translate(0, 0, -0.165)
      geometry.computeVertexNormals()
      const face = new THREE.MeshPhysicalMaterial({
        color: 0xe0e2db,
        metalness: 0.68,
        roughness: 0.31,
        clearcoat: 0.18,
        clearcoatRoughness: 0.35,
      })
      const sides = new THREE.MeshStandardMaterial({ color: 0x656965, metalness: 0.9, roughness: 0.28 })
      const mark = new THREE.Mesh(geometry, [face, sides])
      mark.rotation.y = -0.04
      sculpture.add(mark)

      orbit = new THREE.Group()
      sculpture.add(orbit)
      const ellipse = new THREE.EllipseCurve(0, 0, 2.55, 1.47, 0, Math.PI * 2)
      const orbitPoints = ellipse.getPoints(260).map(point => new THREE.Vector3(point.x, point.y, -0.36))
      const orbitLine = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(orbitPoints),
        new THREE.LineBasicMaterial({ color: 0x999d97, transparent: true, opacity: 0.23, depthWrite: false }),
      )
      orbitLine.rotation.set(0.09, -0.27, -0.09)
      orbit.add(orbitLine)

      node = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.09, 0.09),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(accent) }),
      )
      node.position.set(2.4, 0.75, 0.12)
      sculpture.add(node)

      resize()
      renderFrame(0.016)
      setFallbackVisible(false)
      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(host)
      } else {
        window.addEventListener('resize', resize)
      }
      if ('IntersectionObserver' in window) {
        intersectionObserver = new IntersectionObserver(entries => {
          intersecting = Boolean(entries[0]?.isIntersecting)
          updateLoop()
        }, { threshold: 0.01 })
        intersectionObserver.observe(host)
      }
      updateLoop()
    } catch (error) {
      console.warn('[MoguHero3D] Could not initialise WebGL; using SVG fallback.', error)
      if (!disposed) setFallbackVisible(true)
    }

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', updateLoop)
      media?.removeEventListener('change', onMotionChange)
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      window.removeEventListener('resize', resize)
      renderer?.setAnimationLoop(null)
      const geometries = new Set<THREE.BufferGeometry>()
      const materials = new Set<THREE.Material>()
      scene?.traverse(item => {
        if (item instanceof THREE.Mesh || item instanceof THREE.Line) {
          geometries.add(item.geometry)
          const mats = Array.isArray(item.material) ? item.material : [item.material]
          mats.forEach((mat: THREE.Material) => materials.add(mat))
        }
      })
      geometries.forEach(item => item.dispose())
      materials.forEach(item => item.dispose())
      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
        renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored)
        renderer.domElement.remove()
        renderer.dispose()
        renderer.forceContextLoss()
      }
    }
  }, [accent, autoMotion, mouseParallax, maxPixelRatio])

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="MOGUSTACK 动态立体字母 M 标志"
      style={{ width: '100%', height: '100%', position: 'relative', isolation: 'isolate', overflow: 'hidden', background: 'transparent' }}
    >
      {fallbackVisible && (
        <svg
          viewBox="0 0 920 480"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <ellipse cx="480" cy="248" rx="328" ry="148" transform="rotate(-7 480 248)" fill="none" stroke="#747873" strokeOpacity="0.34" />
          <path d="M350 355 V125 L474 269 L598 125 V355" fill="none" stroke="#D8DAD5" strokeWidth="46" strokeLinejoin="miter" />
          <rect x="734" y="179" width="10" height="10" fill={accent} />
        </svg>
      )}
    </div>
  )
}
