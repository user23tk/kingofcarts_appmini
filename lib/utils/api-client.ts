import { ERROR_MESSAGES } from "@/lib/constants/errors"

/**
 * Configurazione per le richieste API
 */
interface ApiRequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean>
  timeout?: number
}

/**
 * Risposta API tipizzata
 */
interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
  success?: boolean
}

/**
 * Client API centralizzato con gestione errori e timeout
 */
export class ApiClient {
  private baseUrl: string
  private defaultTimeout: number

  constructor(baseUrl = "", defaultTimeout = 30000) {
    this.baseUrl = baseUrl
    this.defaultTimeout = defaultTimeout
  }

  /**
   * Esegue una richiesta HTTP con timeout e gestione errori
   */
  private async request<T = any>(endpoint: string, config: ApiRequestConfig = {}): Promise<ApiResponse<T>> {
    const { params, timeout = this.defaultTimeout, ...fetchConfig } = config

    // Costruisci URL con query params
    let url = `${this.baseUrl}${endpoint}`
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value))
      })
      url += `?${searchParams.toString()}`
    }

    // Crea controller per timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...fetchConfig,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...fetchConfig.headers,
        },
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      if (!response.ok) {
        return {
          error: data.error || ERROR_MESSAGES.OPERATION_FAILED,
          message: data.message,
          success: false,
        }
      }

      return {
        data,
        success: true,
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            error: "Request timeout",
            success: false,
          }
        }
        return {
          error: error.message,
          success: false,
        }
      }

      return {
        error: ERROR_MESSAGES.UNKNOWN_ERROR,
        success: false,
      }
    }
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "GET" })
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, body?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, body?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "DELETE" })
  }
}

// Istanza singleton per l'app
export const apiClient = new ApiClient()
