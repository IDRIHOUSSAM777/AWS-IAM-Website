import { useEffect, useRef } from 'react'

const outline = [
  -1, -1, -1, -1, -1, -1, 0.557, 0.485, 0.45, 0.427, 0.414, 0.326,
  0.28, 0.254, 0.241, 0.238, 0.244, 0.212, 0.173, 0.147, 0.13, 0.117,
  0.111, 0.114, 0.121, 0.134, 0.156, 0.186, 0.235, 0.306, 0.42, 0.44,
  0.469, 0.521, -1, -1, -1, -1, -1, -1, -1,
]
const cubeColors = ['#ff9900', '#f472b6', '#38bdf8', '#c4b5fd', '#ff9900']

type Cube = { x: number; y: number; size: number; velocity: number; color: string }
type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  life: number
  elapsed: number
}
type Ring = { x: number; y: number; radius: number; alpha: number }

export default function CloudParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let imageHeight = 0
    let imageTop = 0
    let cubes: Cube[] = []
    let particles: Particle[] = []
    let rings: Ring[] = []
    let lastFrame = 0
    let spawnIn = 0.8
    let frameId = 0
    let visible = false

    const fit = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * ratio
      canvas.height = height * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      imageHeight = width * 307 / 527
      imageTop = height - imageHeight
    }

    const random = (min: number, max: number) => min + Math.random() * (max - min)
    const outlineY = (x: number) => {
      const position = Math.min(Math.max(x / width, 0), 1) * (outline.length - 1)
      const index = Math.min(outline.length - 2, Math.floor(position))
      const from = outline[index]
      const to = outline[index + 1]
      if (from < 0 || to < 0) return -1
      return imageTop + (from + (to - from) * (position - index)) * imageHeight
    }

    const spawn = () => {
      let x = 0
      for (let attempt = 0; attempt < 12; attempt += 1) {
        x = random(0.17, 0.82) * width
        if (outlineY(x) > 0) break
      }
      const size = Math.max(7, width * 0.026)
      cubes.push({
        x: x - size / 2,
        y: -size,
        size,
        velocity: random(30, 80),
        color: cubeColors[Math.floor(Math.random() * cubeColors.length)],
      })
    }

    const burst = (color: string, x: number, y: number) => {
      for (let index = 0; index < 14; index += 1) {
        const angle = -Math.PI / 2 + random(-1, 1) * 1.05
        const velocity = random(70, 200)
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          size: Math.round(random(2, 4.5)),
          color: Math.random() < 0.4 ? '#86efac' : color,
          life: random(0.45, 0.85),
          elapsed: 0,
        })
      }
      rings.push({ x, y, radius: 3, alpha: 1 })
    }

    const tick = (time: number) => {
      frameId = 0
      if (!visible || document.hidden) {
        lastFrame = 0
        return
      }
      const delta = lastFrame ? Math.min(0.05, (time - lastFrame) / 1000) : 0.016
      lastFrame = time
      if ((spawnIn -= delta) <= 0 && cubes.length < 5) {
        spawn()
        spawnIn = random(0.55, 1.1)
      }

      context.clearRect(0, 0, width, height)
      cubes = cubes.filter((cube) => {
        cube.velocity += 560 * delta
        cube.y += cube.velocity * delta
        const hitX = cube.x + cube.size / 2
        const hitY = outlineY(hitX)
        if (hitY > 0 && cube.y + cube.size >= hitY) {
          burst(cube.color, hitX, hitY)
          return false
        }
        context.fillStyle = cube.color
        context.fillRect(Math.round(cube.x), Math.round(cube.y), cube.size, cube.size)
        context.fillStyle = 'rgba(255,255,255,.35)'
        context.fillRect(Math.round(cube.x), Math.round(cube.y), cube.size, 2)
        return true
      })
      particles = particles.filter((particle) => {
        particle.elapsed += delta
        if (particle.elapsed > particle.life) return false
        particle.vy += 380 * delta
        particle.x += particle.vx * delta
        particle.y += particle.vy * delta
        context.globalAlpha = 1 - particle.elapsed / particle.life
        context.fillStyle = particle.color
        context.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size)
        context.globalAlpha = 1
        return true
      })
      rings = rings.filter((ring) => {
        ring.radius += 80 * delta
        ring.alpha -= 2.4 * delta
        if (ring.alpha <= 0) return false
        context.strokeStyle = `rgba(134,239,172,${ring.alpha})`
        context.lineWidth = 2
        context.beginPath()
        context.arc(ring.x, ring.y, ring.radius, Math.PI, 2 * Math.PI)
        context.stroke()
        return true
      })

      frameId = requestAnimationFrame(tick)
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (frameId) cancelAnimationFrame(frameId)
        frameId = 0
        lastFrame = 0
      } else if (visible && !reducedMotion && !frameId) {
        frameId = requestAnimationFrame(tick)
      }
    }
    const resizeObserver = new ResizeObserver(fit)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (!visible) {
        if (frameId) cancelAnimationFrame(frameId)
        frameId = 0
        lastFrame = 0
      } else if (!reducedMotion && !document.hidden && !frameId) {
        frameId = requestAnimationFrame(tick)
      }
    })

    fit()
    resizeObserver.observe(canvas)
    intersectionObserver.observe(canvas)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [])

  return <canvas ref={canvasRef} className="cloud-particles" aria-hidden="true" />
}
