import { type NextRequest, NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { logger } from "@/lib/debug/logger"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * POST /api/debug/upload
 * Uploads an image to Supabase Storage
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
    const filename = `giveaway-prizes/${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`

    // Convert File to ArrayBuffer then to Buffer for Supabase
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage.from("public-assets").upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
    })

    if (error) {
      // If bucket doesn't exist, try to create it
      if (error.message.includes("Bucket not found")) {
        logger.warn("debug-upload", "Bucket not found, attempting to create", {})

        const { error: createError } = await supabase.storage.createBucket("public-assets", {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024, // 5MB
        })

        if (createError && !createError.message.includes("already exists")) {
          throw createError
        }

        // Retry upload
        const { data: retryData, error: retryError } = await supabase.storage
          .from("public-assets")
          .upload(filename, buffer, {
            contentType: file.type,
            upsert: false,
          })

        if (retryError) throw retryError

        const { data: urlData } = supabase.storage.from("public-assets").getPublicUrl(retryData.path)

        logger.info("debug-upload", "Image uploaded successfully after bucket creation", {
          filename,
          url: urlData.publicUrl,
          size: file.size,
        })

        return NextResponse.json({
          success: true,
          url: urlData.publicUrl,
        })
      }

      throw error
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("public-assets").getPublicUrl(data.path)

    logger.info("debug-upload", "Image uploaded successfully", {
      filename,
      url: urlData.publicUrl,
      size: file.size,
    })

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    logger.error("debug-upload", "Upload failed", { error: errorMessage })
    return NextResponse.json({ error: `Failed to upload image: ${errorMessage}` }, { status: 500 })
  }
}
