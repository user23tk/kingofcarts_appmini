/**
 * NanoGPT API Client
 * OpenAI-compatible API for text, image, and video generation
 * Docs: https://docs.nano-gpt.com
 */

const NANOGPT_BASE_URL = "https://nano-gpt.com/api"
const NANOGPT_V1_URL = `${NANOGPT_BASE_URL}/v1`

function getApiKey(): string {
    const key = process.env.NANOGPT_API_KEY
    if (!key) throw new Error("[NanoGPT] NANOGPT_API_KEY not set in environment")
    return key
}

/** Model env vars with sensible defaults */
export function getChatModel(): string {
    return process.env.NANOGPT_CHAT_MODEL || "chatgpt-4o-latest"
}
export function getImageModel(): string {
    return process.env.NANOGPT_IMAGE_MODEL || "flux"
}

function headers(): Record<string, string> {
    return {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
    }
}

// ─── Chat Completions ────────────────────────────────────────────────

export interface ChatMessage {
    role: "system" | "user" | "assistant"
    content: string
}

export interface ChatCompletionOptions {
    model?: string
    messages: ChatMessage[]
    temperature?: number
    maxTokens?: number
    stream?: boolean
}

export interface ChatCompletionResponse {
    id: string
    choices: Array<{
        index: number
        message: {
            role: string
            content: string
        }
        finish_reason: string
    }>
    usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}

/**
 * Generate a chat completion (non-streaming)
 */
export async function chatCompletion(
    options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
    const {
        model = getChatModel(),
        messages,
        temperature = 0.7,
        maxTokens = 4000,
    } = options

    const response = await fetch(`${NANOGPT_V1_URL}/chat/completions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`[NanoGPT] Chat completion failed (${response.status}): ${errorText}`)
    }

    return response.json()
}

/**
 * Generate a chat completion with streaming (returns ReadableStream)
 */
export async function chatCompletionStream(
    options: ChatCompletionOptions
): Promise<ReadableStream<Uint8Array>> {
    const {
        model = getChatModel(),
        messages,
        temperature = 0.7,
        maxTokens = 4000,
    } = options

    const response = await fetch(`${NANOGPT_V1_URL}/chat/completions`, {
        method: "POST",
        headers: {
            ...headers(),
            Accept: "text/event-stream",
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`[NanoGPT] Chat stream failed (${response.status}): ${errorText}`)
    }

    if (!response.body) {
        throw new Error("[NanoGPT] No response body for stream")
    }

    return response.body
}

// ─── Image Generation ────────────────────────────────────────────────

export interface ImageGenerationOptions {
    model?: string
    prompt: string
    size?: string
    n?: number
    responseFormat?: "url" | "b64_json"
}

export interface ImageGenerationResponse {
    data: Array<{
        url?: string
        b64_json?: string
        revised_prompt?: string
    }>
}

/**
 * Generate an image from a text prompt
 */
export async function generateImage(
    options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
    const {
        model = getImageModel(),
        prompt,
        size = "1024x1024",
        n = 1,
        responseFormat = "url",
    } = options

    const response = await fetch(`${NANOGPT_V1_URL}/images/generations`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
            model,
            prompt,
            size,
            n,
            response_format: responseFormat,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`[NanoGPT] Image generation failed (${response.status}): ${errorText}`)
    }

    return response.json()
}


