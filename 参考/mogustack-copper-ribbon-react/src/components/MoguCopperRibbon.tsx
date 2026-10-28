'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

/**
 * MOGUSTACK hero's RIGHT-SIDE artwork, based on the supplied copper ribbon reference.
 * A genuine, smoothly tessellated 3D ribbon plus an independent copper sphere.
 * No page background, cards, rings, orbit decorations, or page-level UI are rendered.
 *
 * Usage: <div style={{width: '100%', height: 450}}><MoguCopperRibbon /></div>
 */
export type MoguCopperRibbonProps = {
  className?: string
  style?: CSSProperties
  /** Disable motion but retain WebGL 3D material and interaction-free rendering. */
  autoMotion?: boolean
  /** Small orientation change in response to mouse/touch pointer. */
  mouseParallax?: boolean
  /** Caps GPU pixel ratio to keep the hero lightweight on HiDPI devices. */
  maxPixelRatio?: number
  /** Use the included public/ribbon-fallback.webp for no-WebGL fallback. */
  fallbackSrc?: string
}

const PATH_POINTS = [
  [-3.78, -1.34, 0.12],
  [-3.25, -1.05, 0.10],
  [-2.45, -0.24, 0.05],
  [-1.43, 1.03, 0.05],
  [-0.62, 1.66, 0.15],
  [0.12, 1.59, 0.08],
  [0.89, 0.59, -0.05],
  [1.72, -0.60, -0.02],
  [2.39, -1.33, 0.13],
  [2.83, -1.45, 0.05],
  [3.19, -1.17, -0.04],
] as const

const COPPER_STOPS = [
  { u: 0, color: new THREE.Color('#F4C3A7') },
  { u: 0.24, color: new THREE.Color('#E5A382') },
  { u: 0.47, color: new THREE.Color('#C47452') },
  { u: 0.72, color: new THREE.Color('#AD6048') },
  { u: 1, color: new THREE.Color('#C27A5C') },
]

function interpolateCopper(u: number): THREE.Color {
  for (let i = 1; i < COPPER_STOPS.length; i++) {
    const right = COPPER_STOPS[i]
    if (u <= right.u) {
      const left = COPPER_STOPS[i - 1]
      return left.color.clone().lerp(right.color, (u - left.u) / (right.u - left.u))
    }
  }
  return COPPER_STOPS[COPPER_STOPS.length - 1].color.clone()
}

function smoothstep(a: number, b: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** A varying-width ruled surface, not a tube or a flat letter extrusion. */
function createRibbonGeometry(): THREE.BufferGeometry {
  const path = new THREE.CatmullRomCurve3(
    PATH_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
    0.5,
  )

  const along = 220
  const across = 20
  const stride = across + 1
  const vertexCount = (along + 1) * stride
  const positions = new Float32Array(vertexCount * 3)
  const colors = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const indices: number[] = []

  const worldNormal = new THREE.Vector3()
  const depthAxis = new THREE.Vector3(0, 0, 1)

  for (let i = 0; i <= along; i++) {
    const u = i / along
    const center = path.getPoint(u)
    const tangent = path.getTangent(u).normalize()

    // A strip oriented mostly within the XY plane, twisted through the crest
    // to expose both sides to different studio lights.
    worldNormal.set(-tangent.y, tangent.x, 0).normalize()
    const twist =
      0.14 +
      0.58 * Math.sin(u * Math.PI * 1.12) -
      0.58 * smoothstep(0.54, 0.87, u)
    const transverse = worldNormal.multiplyScalar(Math.cos(twist))
      .addScaledVector(depthAxis, Math.sin(twist)).normalize()

    // Pinched, tapered ribbon endpoints. A smooth taper avoids blunt, tube-like ends.
    const leftTaper = smoothstep(0.0, 0.19, u)
    const rightTaper = 1 - smoothstep(0.88, 1.0, u)
    const fullWidth = (0.74 + 0.20 * Math.sin(u * Math.PI)) * leftTaper * rightTaper
    const safeWidth = Math.max(0.007, fullWidth)
    const baseColor = interpolateCopper(u)

    for (let j = 0; j <= across; j++) {
      const v = (j / across) * 2 - 1
      const index = i * stride + j
      const point = center.clone().addScaledVector(transverse, v * safeWidth * 0.5)

      // Very subtle curvature of the copper sheet across its width.
      point.z += 0.06 * (1 - v * v) * Math.sin(Math.PI * u)
      point.z += 0.025 * v * Math.cos(u * 4.2)

      positions.set([point.x, point.y, point.z], index * 3)
      uvs.set([u, j / across], index * 2)

      // Deliberate warm value variation across the sheet. Actual specular
      // highlights are from PBR lights and environment, not a flat image.
      const brightness = 0.91 + 0.085 * ((v + 1) / 2) + 0.025 * Math.cos(u * 7 + v * 2.7)
      colors[index * 3] = Math.min(1, baseColor.r * brightness)
      colors[index * 3 + 1] = Math.min(1, baseColor.g * brightness)
      colors[index * 3 + 2] = Math.min(1, baseColor.b * brightness)
    }
  }

  for (let i = 0; i < along; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * stride + j
      const b = (i + 1) * stride + j
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** Pure SVG fallback: always usable when only the TSX file is copied. */
function InlineFallback() {
  return (
    <svg aria-hidden="true" viewBox="0 0 900 520" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="mogu-copper-ribbon-face" x1="0%" y1="10%" x2="100%" y2="85%">
          <stop offset="0%" stopColor="#F5CCB2" />
          <stop offset="34%" stopColor="#E1A184" />
          <stop offset="75%" stopColor="#B7654B" />
          <stop offset="100%" stopColor="#D08A66" />
        </linearGradient>
        <radialGradient id="mogu-copper-orb" cx="70%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#FAD2B2" />
          <stop offset="42%" stopColor="#D58F6F" />
          <stop offset="100%" stopColor="#A65038" />
        </radialGradient>
      </defs>
      <path d="M 45 427 C 172 418 261 201 383 111 C 437 72 505 92 551 147 C 640 255 672 414 755 427 C 786 433 809 425 822 414 C 792 434 768 459 718 454 C 595 440 554 289 468 193 C 428 148 402 156 379 177 C 273 260 200 467 45 427 Z" fill="url(#mogu-copper-ribbon-face)" />
      <circle cx="834" cy="390" r="49" fill="url(#mogu-copper-orb)" />
    </svg>
  )
}

export default function MoguCopperRibbon({
  className,
  style,
  autoMotion = true,
  mouseParallax = true,
  maxPixelRatio = 1.75,
  fallbackSrc,
}: MoguCopperRibbonProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [showFallback, setShowFallback] = useState(true)

  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof window === 'undefined') return

    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.OrthographicCamera | null = null
    let sculpture: THREE.Group | null = null
    let sphere: THREE.Mesh | null = null
    let observer: ResizeObserver | null = null
    let intersection: IntersectionObserver | null = null
    let environmentMap: THREE.Texture | null = null
    let pmrem: THREE.PMREMGenerator | null = null
    let room: RoomEnvironment | null = null
    let disposed = false
    let contextLost = false
    let inViewport = true
    let reducedMotion = false
    let elapsed = 0
    let lastFrame = 0
    const pointer = new THREE.Vector2()
    const currentPointer = new THREE.Vector2()
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    reducedMotion = motionQuery?.matches ?? false

    function draw(delta: number) {
      if (!renderer || !scene || !camera || !sculpture || !sphere || disposed || contextLost) return
      const step = Math.min(Math.max(delta, 0), 0.05)
      const animate = autoMotion && !reducedMotion
      elapsed += animate ? step : 0
      currentPointer.lerp(pointer, 1 - Math.exp(-5 * (step || 0.016)))

      // Dynamic 3D: small, carefully damped orientation and independent orbit-free sphere movement.
      sculpture.rotation.y = 0.035 + (mouseParallax && !reducedMotion ? currentPointer.x * 0.095 : 0)
        + (animate ? Math.sin(elapsed * 0.31) * 0.038 : 0)
      sculpture.rotation.x = -0.015 + (mouseParallax && !reducedMotion ? -currentPointer.y * 0.065 : 0)
      sculpture.rotation.z = animate ? Math.sin(elapsed * 0.36) * 0.006 : 0
      sculpture.position.y = animate ? Math.sin(elapsed * 0.68) * 0.045 : 0
      sphere.position.y = -0.82 + (animate ? Math.sin(elapsed * 0.78 + 0.9) * 0.052 : 0)
      sphere.position.x = 3.59 + (mouseParallax && !reducedMotion ? currentPointer.x * 0.035 : 0)
      renderer.render(scene, camera)
    }

    function tick(timeMs: number) {
      const delta = lastFrame ? (timeMs - lastFrame) / 1000 : 0.016
      lastFrame = timeMs
      draw(delta)
    }

    function syncLoop() {
      if (!renderer || disposed || contextLost) return
      const isVisible = inViewport && !document.hidden
      const shouldLoop = isVisible && !reducedMotion && (autoMotion || mouseParallax)
      renderer.setAnimationLoop(shouldLoop ? tick : null)
      lastFrame = 0
      if (isVisible && !shouldLoop) draw(0)
    }

    function resize() {
      if (!renderer || !camera || disposed || contextLost) return
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)
      const aspect = width / height
      // A narrower host scales the subject down rather than cutting off the sphere.
      const halfHeight = 2.94 * Math.max(1, 1.49 / aspect)
      camera.left = -halfHeight * aspect
      camera.right = halfHeight * aspect
      camera.top = halfHeight
      camera.bottom = -halfHeight
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Math.max(1, maxPixelRatio)))
      renderer.setSize(width, height, false)
      draw(0)
    }

    function onPointerMove(event: PointerEvent) {
      if (!mouseParallax || reducedMotion) return
      const bounds = host.getBoundingClientRect()
      if (bounds.width === 0 || bounds.height === 0) return
      pointer.set(
        THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, -1, 1),
        THREE.MathUtils.clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 2, -1, 1),
      )
      if (!autoMotion) { currentPointer.copy(pointer); draw(0) }
    }

    function onPointerLeave() {
      pointer.set(0, 0)
      if (!autoMotion) { currentPointer.set(0, 0); draw(0) }
    }

    function onMotionChange(event: MediaQueryListEvent) {
      reducedMotion = event.matches
      if (reducedMotion) { pointer.set(0, 0); currentPointer.set(0, 0) }
      syncLoop()
    }

    function contextLoss(event: Event) {
      event.preventDefault()
      contextLost = true
      renderer?.setAnimationLoop(null)
      if (!disposed) setShowFallback(true)
    }

    function contextRestore() {
      contextLost = false
      resize()
      if (!disposed) setShowFallback(false)
      syncLoop()
    }

    host.addEventListener('pointermove', onPointerMove, { passive: true })
    host.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', syncLoop)
    motionQuery?.addEventListener('change', onMotionChange)

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.35
      renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;'
      renderer.domElement.setAttribute('aria-hidden', 'true')
      renderer.domElement.addEventListener('webglcontextlost', contextLoss)
      renderer.domElement.addEventListener('webglcontextrestored', contextRestore)
      host.appendChild(renderer.domElement)

      scene = new THREE.Scene() // transparent: existing Hero pattern remains visible
      camera = new THREE.OrthographicCamera(-4.4, 4.4, 2.94, -2.94, 0.1, 100)
      camera.position.set(0, 0, 13)
      camera.lookAt(0, 0, 0)

      // Procedural studio reflection: bundled with Three.js; no external HDR files.
      room = new RoomEnvironment()
      pmrem = new THREE.PMREMGenerator(renderer)
      environmentMap = pmrem.fromScene(room, 0.05).texture
      scene.environment = environmentMap

      scene.add(new THREE.HemisphereLight(0xffe8d5, 0x3c1914, 1.6))
      const softKey = new THREE.DirectionalLight(0xffead9, 3.5)
      softKey.position.set(-3.2, 4.2, 5.5)
      scene.add(softKey)
      const roseFill = new THREE.DirectionalLight(0xffb38d, 1.8)
      roseFill.position.set(3, -0.7, 4.8)
      scene.add(roseFill)
      const edgeLight = new THREE.DirectionalLight(0xffcbb3, 2.1)
      edgeLight.position.set(0.5, 0.3, -4.5)
      scene.add(edgeLight)

      sculpture = new THREE.Group()
      scene.add(sculpture)
      const ribbonGeometry = createRibbonGeometry()
      const ribbonMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        vertexColors: true,
        metalness: 0.62,
        roughness: 0.31,
        clearcoat: 0.3,
        clearcoatRoughness: 0.28,
        envMapIntensity: 1.25,
        side: THREE.DoubleSide,
      })
      const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial)
      ribbon.frustumCulled = false
      sculpture.add(ribbon)

      const sphereGeometry = new THREE.SphereGeometry(0.44, 72, 48)
      const sphereMaterial = new THREE.MeshPhysicalMaterial({
        color: '#CA815D',
        metalness: 0.67,
        roughness: 0.27,
        clearcoat: 0.38,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.5,
      })
      sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
      sphere.position.set(3.59, -0.82, 0.38)
      scene.add(sphere)

      if ('ResizeObserver' in window) {
        observer = new ResizeObserver(resize)
        observer.observe(host)
      } else {
        window.addEventListener('resize', resize)
      }
      if ('IntersectionObserver' in window) {
        intersection = new IntersectionObserver(([entry]) => {
          inViewport = entry.isIntersecting
          syncLoop()
        }, { threshold: 0.01 })
        intersection.observe(host)
      }
      resize()
      setShowFallback(false)
      syncLoop()
    } catch (error) {
      // Broken or unavailable WebGL: keep the deterministic visual fallback.
      console.warn('[MoguCopperRibbon] WebGL initialization failed:', error)
      if (!disposed) setShowFallback(true)
    }

    return () => {
      disposed = true
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', syncLoop)
      motionQuery?.removeEventListener('change', onMotionChange)
      observer?.disconnect()
      intersection?.disconnect()
      window.removeEventListener('resize', resize)
      renderer?.setAnimationLoop(null)
      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', contextLoss)
        renderer.domElement.removeEventListener('webglcontextrestored', contextRestore)
      }
      // Explicitly free GPU resources, including the generated PMREM environment.
      if (sculpture) sculpture.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach(m => m.dispose())
        }
      })
      sphere?.geometry.dispose()
      if (sphere?.material instanceof THREE.Material) sphere.material.dispose()
      scene && (scene.environment = null)
      environmentMap?.dispose()
      pmrem?.dispose()
      room?.dispose()
      if (renderer) {
        renderer.dispose()
        renderer.domElement.remove()
      }
    }
  }, [autoMotion, mouseParallax, maxPixelRatio])

  return (
    <div
      ref={hostRef}
      className={className}
      role="img"
      aria-label="一条起伏的玫瑰铜色金属丝带和右侧悬浮铜球，缓慢随指针产生三维视差"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
    >
      {showFallback && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
          {fallbackSrc ? (
            <img src={fallbackSrc} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : <InlineFallback />}
        </div>
      )}
    </div>
  )
}
