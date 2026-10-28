'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'

/**
 * Fidelity-first Three.js artwork for the right side of MOGUSTACK's Hero.
 * IMPORTANT: the reference art supplies the silhouette and pre-rendered copper
 * reflections. Textures sit on subtly warped 3D meshes; this is NOT a freely
 * rotatable, fully reconstructed metal sculpture. Keep motion restrained.
 *
 * Copy /public/ribbon.png, /public/orb.png and /public/reference-composite.png
 * into your React project's public directory alongside this component.
 */
export interface MoguCopperRibbonProps {
  className?: string
  style?: CSSProperties
  ribbonSrc?: string
  orbSrc?: string
  fallbackSrc?: string
  autoMotion?: boolean
  mouseParallax?: boolean
  maxPixelRatio?: number
  /** Most sites should leave this at 1. Recommended range 0.9 - 1.08 */
  scale?: number
}

const UNIT = 0.0098
const REF_CENTER_X = 655
const REF_CENTER_Y = 635
const BOX_RIBBON = { x: 131, y: 382, w: 976, h: 506 }
const BOX_ORB = { x: 1029, y: 640, w: 149, h: 151 }

function referenceFrame(rect: { x: number; y: number; w: number; h: number }) {
  return {
    w: rect.w * UNIT,
    h: rect.h * UNIT,
    x: (rect.x + rect.w / 2 - REF_CENTER_X) * UNIT,
    y: (REF_CENTER_Y - rect.y - rect.h / 2) * UNIT,
  }
}

/** A subtly twisted piece of geometry rather than an un-deformed flat plane. */
function createRibbonSurface(width: number, height: number) {
  const geometry = new THREE.PlaneGeometry(width, height, 96, 44)
  const position = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const u = x / width + 0.5
    const v = y / height + 0.5

    // Lift the middle fold slightly into depth. All UVs and XY silhouette
    // remain grounded in the supplied art to avoid a second approximation.
    const fold = 0.27 * Math.sin(Math.PI * u) * Math.sin(Math.PI * u)
    const roll = 0.115 * (v - 0.5) * Math.sin(2.15 * Math.PI * u)
    position.setZ(i, fold + roll)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** A gently curved front dome; UVs still preserve the photographed ball. */
function createOrbSurface(width: number, height: number) {
  const geometry = new THREE.PlaneGeometry(width, height, 40, 40)
  const position = geometry.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < position.count; i++) {
    const nx = (position.getX(i) / width) * 2
    const ny = (position.getY(i) / height) * 2
    const radial = nx * nx + ny * ny
    position.setZ(i, radial < 1 ? 0.38 * Math.sqrt(1 - radial) : 0)
  }
  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function getMotionQuery() {
  if (typeof window === 'undefined' || !window.matchMedia) return null
  return window.matchMedia('(prefers-reduced-motion: reduce)')
}

export default function MoguCopperRibbon({
  className,
  style,
  ribbonSrc = '/ribbon.png',
  orbSrc = '/orb.png',
  fallbackSrc = '/reference-composite.png',
  autoMotion = true,
  mouseParallax = true,
  maxPixelRatio = 1.75,
  scale = 1,
}: MoguCopperRibbonProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [fallbackVisible, setFallbackVisible] = useState(true)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer | null = null
    let camera: THREE.OrthographicCamera | null = null
    const scene = new THREE.Scene()
    const ribbonFrame = referenceFrame(BOX_RIBBON)
    const orbFrame = referenceFrame(BOX_ORB)
    const ribbonPivot = new THREE.Group()
    const orbPivot = new THREE.Group()
    let ribbonMesh: THREE.Mesh | null = null
    let orbMesh: THREE.Mesh | null = null
    let resizeObserver: ResizeObserver | null = null
    let intersectionObserver: IntersectionObserver | null = null
    let initialized = false
    let visible = true
    let disposed = false
    let contextLost = false
    let reduced = getMotionQuery()?.matches ?? false
    let elapsed = 0
    let previous = 0
    const mouseTarget = new THREE.Vector2()
    const mouseCurrent = new THREE.Vector2()
    const media = getMotionQuery()

    function renderFrame(delta = 1 / 60) {
      if (!renderer || !camera || !initialized || disposed || contextLost) return
      const dt = Math.max(0, Math.min(0.05, delta))
      const animate = autoMotion && !reduced
      if (animate) elapsed += dt
      mouseCurrent.lerp(mouseTarget, 1 - Math.exp(-6 * dt))

      // Small, damped parallax. A wide orbit would reveal the textured nature
      // of the source, so the maximum rotation deliberately remains ~2deg.
      ribbonPivot.rotation.y = mouseParallax && !reduced ? mouseCurrent.x * 0.034 : 0
      ribbonPivot.rotation.x = mouseParallax && !reduced ? -mouseCurrent.y * 0.023 : 0
      ribbonPivot.rotation.z = animate ? Math.sin(elapsed * 0.33) * 0.0035 : 0
      ribbonPivot.position.y = animate ? Math.sin(elapsed * 0.66) * 0.037 : 0

      orbPivot.rotation.y = mouseParallax && !reduced ? mouseCurrent.x * 0.05 : 0
      orbPivot.position.y = animate ? Math.sin(elapsed * 0.79 + 0.9) * 0.055 : 0
      orbPivot.position.z = 0.16 + (mouseParallax && !reduced ? mouseCurrent.x * 0.036 : 0)
      renderer.render(scene, camera)
    }

    function animationLoop(timeMs: number) {
      const dt = previous ? (timeMs - previous) / 1000 : 1 / 60
      previous = timeMs
      renderFrame(dt)
    }

    function syncAnimation() {
      if (!renderer || disposed || !initialized || contextLost) return
      const canDraw = visible && !document.hidden
      const needsLoop = canDraw && !reduced && (autoMotion || mouseParallax)
      renderer.setAnimationLoop(needsLoop ? animationLoop : null)
      previous = 0
      if (canDraw && !needsLoop) renderFrame()
    }

    function resize() {
      if (!renderer || !camera || disposed || contextLost) return
      const w = Math.max(1, host!.clientWidth)
      const h = Math.max(1, host!.clientHeight)
      const aspect = w / h
      const contentWidth = 10.95 / scale
      const contentHeight = 5.62 / scale
      // Fit (never crop) across desktop, laptop and smaller right-side columns.
      const width = Math.max(contentWidth, contentHeight * aspect)
      const height = width / aspect
      camera.left = -width / 2
      camera.right = width / 2
      camera.top = height / 2
      camera.bottom = -height / 2
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Math.max(1, maxPixelRatio)))
      renderer.setSize(w, h, false)
      renderFrame()
    }

    function pointerMove(event: PointerEvent) {
      if (!mouseParallax || reduced) return
      const { left, top, width, height } = host!.getBoundingClientRect()
      mouseTarget.set(
        THREE.MathUtils.clamp(2 * ((event.clientX - left) / width - 0.5), -1, 1),
        THREE.MathUtils.clamp(2 * ((event.clientY - top) / height - 0.5), -1, 1),
      )
      if (!autoMotion) {
        mouseCurrent.copy(mouseTarget)
        renderFrame()
      }
    }

    function pointerLeave() {
      mouseTarget.set(0, 0)
      if (!autoMotion) {
        mouseCurrent.set(0, 0)
        renderFrame()
      }
    }

    function handleMotionChange(event: MediaQueryListEvent) {
      reduced = event.matches
      if (reduced) {
        mouseTarget.set(0, 0)
        mouseCurrent.set(0, 0)
      }
      syncAnimation()
    }

    function handleLoss(event: Event) {
      event.preventDefault()
      contextLost = true
      renderer?.setAnimationLoop(null)
      if (!disposed) setFallbackVisible(true)
    }

    function handleRestore() {
      contextLost = false
      resize()
      renderFrame()
      if (!disposed) setFallbackVisible(false)
      syncAnimation()
    }

    host.addEventListener('pointermove', pointerMove, { passive: true })
    host.addEventListener('pointerleave', pointerLeave)
    document.addEventListener('visibilitychange', syncAnimation)
    media?.addEventListener('change', handleMotionChange)

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.domElement.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;pointer-events:none;'
      renderer.domElement.setAttribute('aria-hidden', 'true')
      renderer.domElement.addEventListener('webglcontextlost', handleLoss)
      renderer.domElement.addEventListener('webglcontextrestored', handleRestore)
      host.appendChild(renderer.domElement)

      camera = new THREE.OrthographicCamera(-5.5, 5.5, 2.81, -2.81, 0.1, 50)
      camera.position.set(0, 0, 19)
      camera.lookAt(0, 0, 0)

      // Read the user's actual art; do not algorithmically reinvent the shape.
      const loader = new THREE.TextureLoader()
      const pending = Promise.all([loader.loadAsync(ribbonSrc), loader.loadAsync(orbSrc)])
      void pending.then(([ribbonTexture, orbTexture]) => {
        if (disposed) {
          ribbonTexture.dispose()
          orbTexture.dispose()
          return
        }
        ribbonTexture.colorSpace = THREE.SRGBColorSpace
        orbTexture.colorSpace = THREE.SRGBColorSpace
        ribbonTexture.anisotropy = Math.min(renderer!.capabilities.getMaxAnisotropy(), 8)
        orbTexture.anisotropy = Math.min(renderer!.capabilities.getMaxAnisotropy(), 8)

        const ribbonMaterial = new THREE.MeshBasicMaterial({
          map: ribbonTexture, transparent: true, depthWrite: false,
          toneMapped: false, side: THREE.DoubleSide,
        })
        ribbonMesh = new THREE.Mesh(createRibbonSurface(ribbonFrame.w, ribbonFrame.h), ribbonMaterial)
        ribbonMesh.position.set(ribbonFrame.x, ribbonFrame.y, 0)
        ribbonMesh.renderOrder = 1
        ribbonPivot.add(ribbonMesh)

        const orbMaterial = new THREE.MeshBasicMaterial({
          map: orbTexture, transparent: true, depthWrite: false,
          toneMapped: false, side: THREE.DoubleSide,
        })
        orbMesh = new THREE.Mesh(createOrbSurface(orbFrame.w, orbFrame.h), orbMaterial)
        orbMesh.position.set(orbFrame.x, orbFrame.y, 0)
        orbMesh.renderOrder = 2
        orbPivot.add(orbMesh)
        scene.add(ribbonPivot, orbPivot)
        initialized = true
        resize()
        renderFrame()
        if (!disposed) setFallbackVisible(false)
        syncAnimation()
      }).catch(error => {
        console.warn('[MoguCopperRibbon] Reference textures failed to load:', error)
        if (!disposed) setFallbackVisible(true)
      })

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(host)
      } else {
        window.addEventListener('resize', resize)
      }
      if (typeof IntersectionObserver !== 'undefined') {
        intersectionObserver = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting
          syncAnimation()
        }, { threshold: 0.01 })
        intersectionObserver.observe(host)
      }
      resize()
    } catch (error) {
      console.warn('[MoguCopperRibbon] Three.js initialization failed:', error)
      setFallbackVisible(true)
    }

    return () => {
      disposed = true
      host.removeEventListener('pointermove', pointerMove)
      host.removeEventListener('pointerleave', pointerLeave)
      document.removeEventListener('visibilitychange', syncAnimation)
      media?.removeEventListener('change', handleMotionChange)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      window.removeEventListener('resize', resize)
      renderer?.setAnimationLoop(null)
      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', handleLoss)
        renderer.domElement.removeEventListener('webglcontextrestored', handleRestore)
      }
      for (const mesh of [ribbonMesh, orbMesh]) {
        mesh?.geometry.dispose()
        if (mesh?.material instanceof THREE.MeshBasicMaterial) {
          mesh.material.map?.dispose()
          mesh.material.dispose()
        }
      }
      renderer?.dispose()
      renderer?.domElement.remove()
    }
  }, [ribbonSrc, orbSrc, autoMotion, mouseParallax, maxPixelRatio, scale])

  return (
    <div
      ref={hostRef}
      className={className}
      role="img"
      aria-label="玫瑰铜色曲面丝带与右侧圆球，随指针轻微产生空间视差"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
    >
      {fallbackVisible && (
        <img
          src={fallbackSrc}
          alt=""
          draggable={false}
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
        />
      )}
    </div>
  )
}
