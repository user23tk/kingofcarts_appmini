import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"

/**
 * POST /api/debug/upload
 * Uploads an image to Vercel Blob storage
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireDebugAuth(request)
  if (!authCheck.authorized) return authCheck.response!

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split(".").pop() || "png"
    const filename = `giveaway-prizes/${timestamp}.${extension}`

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: true,
    })

    logger.info("debug-upload", "Image uploaded successfully", {
      filename,
      url: blob.url,
      size: file.size,
    })

    return NextResponse.json({
      success: true,
      url: blob.url,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    logger.error("debug-upload", "Upload failed", { error: errorMessage })
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
  }
}
