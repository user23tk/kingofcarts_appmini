"use client"

import { useEffect, useRef, useState } from "react"
import { getThemeColors, type ThemeName } from "@/lib/theme-colors"

interface AnimatedBackgroundProps {
  theme: ThemeName
  intensity?: "low" | "medium" | "high"
  variant?: "scene" | "menu"
  backgroundImageUrl?: string | null
}

const clampOpacity = (value: number): number => {
  const clamped = Math.max(0, Math.min(1, value))
  if (Number.isNaN(clamped)) {
    console.warn("[v0] Invalid opacity value, using 0.5 as fallback")
    return 0.5
  }
  return clamped
}

const hexToRgba = (hex: string, alpha: number): string => {
  // Remove # if present
  hex = hex.replace("#", "")

  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("")
  }

  // Validate hex length
  if (hex.length !== 6) {
    console.warn(`[v0] Invalid hex color: ${hex}, using fallback`)
    return `rgba(255, 255, 255, ${clampOpacity(alpha)})`
  }

  // Parse RGB values
  const r = Number.parseInt(hex.substring(0, 2), 16)
  const g = Number.parseInt(hex.substring(2, 4), 16)
  const b = Number.parseInt(hex.substring(4, 6), 16)

  // Validate parsed values
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    console.warn(`[v0] Failed to parse hex color: ${hex}, using fallback`)
    return `rgba(255, 255, 255, ${clampOpacity(alpha)})`
  }

  // Clamp alpha between 0 and 1
  const clampedAlpha = clampOpacity(alpha)

  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`
}

export function AnimatedBackground({ theme, intensity = "medium", variant = "scene", backgroundImageUrl }: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const colors = getThemeColors(theme)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    if (backgroundImageUrl) {
      setImageLoaded(false)
      const img = new Image()
      img.onload = () => setImageLoaded(true)
      img.onerror = () => setImageLoaded(false)
      img.src = backgroundImageUrl
    } else {
      setImageLoaded(false)
    }
  }, [backgroundImageUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    // Set canvas size
    const updateSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    updateSize()
    window.addEventListener("resize", updateSize)

    // Particle system for theme effects
    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      size: number
      opacity: number
    }> = []

    const particleCount = intensity === "low" ? 20 : intensity === "medium" ? 40 : 60

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 1,
        opacity: clampOpacity(Math.random() * 0.5 + 0.2),
      })
    }

    let animationId: number

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width
        if (particle.x > canvas.width) particle.x = 0
        if (particle.y < 0) particle.y = canvas.height
        if (particle.y > canvas.height) particle.y = 0

        // Draw particle without shadow effects
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = hexToRgba(colors.light, particle.opacity)
        ctx.fill()
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", updateSize)
      cancelAnimationFrame(animationId)
    }
  }, [theme, intensity, colors])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black">
      {/* Background Image (Full screen) */}
      {backgroundImageUrl && (
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          style={{
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      {/* Base gradient layer (over the image) */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.08)}, ${hexToRgba(colors.light, 0.08)})`,
        }}
      />

      {/* Animated gradient orbs */}
      <div className="absolute inset-0">
        <div
          className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{
            backgroundColor: colors.primary,
            animation: "float 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{
            backgroundColor: colors.light,
            animation: "float 10s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Canvas for particle effects */}
      <canvas ref={canvasRef} className="absolute inset-0 opacity-60" />

      {/* Theme-specific effects */}
      {theme === "fantasy" && (
        <div className="absolute inset-0">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute h-2 w-2 rounded-full bg-purple-300 opacity-30"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `drift ${8 + i * 2}s linear infinite`,
              }}
            />
          ))}
        </div>
      )}

      {theme === "sci-fi" && (
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(${colors.primary} 1px, transparent 1px),
                linear-gradient(90deg, ${colors.primary} 1px, transparent 1px)
              `,
              backgroundSize: "50px 50px",
              animation: "shimmer 20s linear infinite",
            }}
          />
        </div>
      )}

      {theme === "mystery" && (
        <div className="absolute inset-0 opacity-30">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, transparent 0%, ${hexToRgba(colors.primary, 0.25)} 100%)`,
              animation: "pulse-glow 4s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {/* Overlay gradient for text readability */}
      <div
        className="absolute inset-0"
        style={{
          background:
            variant === "scene"
              ? "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.6) 100%)"
              : "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 100%)",
        }}
      />
    </div>
  )
}
