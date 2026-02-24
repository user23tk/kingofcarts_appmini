"use client"

import type React from "react"

import { useEffect, useState } from "react"
import type { ThemeName } from "@/lib/theme-colors"

interface StorySceneProps {
  theme: ThemeName
  sceneText: string
  sceneIndex: number
  chapterNumber: number
  isLoading?: boolean
  backgroundImageUrl?: string | null
}

function parseStoryText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let key = 0

  // First, clean up any malformed tags (like <b><b> or unclosed tags)
  const cleanedText = text
    // Remove duplicate opening tags (e.g., <b><b> becomes <b>)
    .replace(/<(b|i)>(\s*<\1>)+/g, "<$1>")
    // Remove duplicate closing tags (e.g., </b></b> becomes </b>)
    .replace(/<\/(b|i)>(\s*<\/\1>)+/g, "</$1>")
    // Fix unclosed tags at the end by adding closing tags
    .replace(/<b>(?![^]*<\/b>)/g, "<b></b>")
    .replace(/<i>(?![^]*<\/i>)/g, "<i></i>")

  console.log("[v0] Original text:", text)
  console.log("[v0] Cleaned text:", cleanedText)

  // Split by HTML tags while keeping the tags
  const tokens = cleanedText.split(/(<\/?(?:b|i)>)/g).filter((token) => token.length > 0)

  console.log("[v0] Tokens:", tokens)

  let boldOpen = false
  let italicOpen = false
  let currentText = ""

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token === "<b>") {
      // If we have accumulated text, push it first
      if (currentText) {
        if (italicOpen) {
          parts.push(<em key={key++}>{currentText}</em>)
        } else {
          parts.push(currentText)
        }
        currentText = ""
      }
      boldOpen = true
    } else if (token === "</b>") {
      // Close bold tag
      if (currentText) {
        if (italicOpen) {
          parts.push(
            <strong key={key++}>
              <em>{currentText}</em>
            </strong>,
          )
        } else {
          parts.push(<strong key={key++}>{currentText}</strong>)
        }
        currentText = ""
      }
      boldOpen = false
    } else if (token === "<i>") {
      // If we have accumulated text, push it first
      if (currentText) {
        if (boldOpen) {
          parts.push(<strong key={key++}>{currentText}</strong>)
        } else {
          parts.push(currentText)
        }
        currentText = ""
      }
      italicOpen = true
    } else if (token === "</i>") {
      // Close italic tag
      if (currentText) {
        if (boldOpen) {
          parts.push(
            <strong key={key++}>
              <em>{currentText}</em>
            </strong>,
          )
        } else {
          parts.push(<em key={key++}>{currentText}</em>)
        }
        currentText = ""
      }
      italicOpen = false
    } else {
      // Regular text - accumulate it
      currentText += token
    }
  }

  // Push any remaining text
  if (currentText) {
    if (boldOpen && italicOpen) {
      parts.push(
        <strong key={key++}>
          <em>{currentText}</em>
        </strong>,
      )
    } else if (boldOpen) {
      parts.push(<strong key={key++}>{currentText}</strong>)
    } else if (italicOpen) {
      parts.push(<em key={key++}>{currentText}</em>)
    } else {
      parts.push(currentText)
    }
  }

  console.log("[v0] Parsed parts count:", parts.length)

  return parts.length > 0 ? parts : [text]
}

export function StoryScene({ theme, sceneText, sceneIndex, chapterNumber, isLoading = false, backgroundImageUrl }: StorySceneProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Fade in animation on mount
  useEffect(() => {
    setIsVisible(false)
    setImageLoaded(false)
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [sceneIndex])

  // Preload background image
  useEffect(() => {
    if (backgroundImageUrl) {
      const img = new Image()
      img.onload = () => setImageLoaded(true)
      img.onerror = () => setImageLoaded(false)
      img.src = backgroundImageUrl
    }
  }, [backgroundImageUrl])

  // Optional typewriter effect (can be toggled)
  useEffect(() => {
    if (!isTyping) {
      setDisplayedText(sceneText)
      return
    }

    setDisplayedText("")
    let currentIndex = 0
    const interval = setInterval(() => {
      if (currentIndex <= sceneText.length) {
        setDisplayedText(sceneText.slice(0, currentIndex))
        currentIndex++
      } else {
        clearInterval(interval)
      }
    }, 30)

    return () => clearInterval(interval)
  }, [sceneText, isTyping])

  if (isLoading) {
    return (
      <div className="relative flex items-center justify-center h-full">
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-lg text-white/80">Caricamento scena...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
    >
      {/* Background image */}
      {backgroundImageUrl && (
        <div
          className={`absolute inset-0 rounded-2xl transition-opacity duration-1000 ${imageLoaded ? "opacity-100" : "opacity-0"
            }`}
          style={{
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      {/* Scene text */}
      <div className={`relative rounded-2xl p-6 md:p-8 backdrop-blur-md ${backgroundImageUrl && imageLoaded
          ? "bg-black/50"
          : "bg-black/20"
        }`}>
        <p
          className="text-balance text-center text-lg md:text-xl leading-relaxed text-white"
          style={{
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
          }}
        >
          {parseStoryText(displayedText || sceneText)}
        </p>
      </div>
    </div>
  )
}
