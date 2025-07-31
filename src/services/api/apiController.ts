interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
}

interface RequestConfig {
  headers?: Record<string, string>
  timeout?: number
  retries?: number
}

class ApiController {
  private baseURL: string
  private defaultHeaders: Record<string, string>

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || ''
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`
    const { timeout = 30000, retries = 3 } = config

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...config.headers,
        ...options.headers,
      },
    }

    // Add auth token if available
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth-token')
      if (token) {
        requestOptions.headers = {
          ...requestOptions.headers,
          Authorization: `Bearer ${token}`,
        }
      }
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        let responseData: any
        const contentType = response.headers.get('content-type')
        
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json()
        } else {
          responseData = await response.text()
        }

        if (!response.ok) {
          return {
            success: false,
            error: responseData.error || responseData.message || `HTTP ${response.status}`,
            code: response.status.toString(),
          }
        }

        return {
          success: true,
          data: responseData,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
            code: 'TIMEOUT',
          }
        }

        // Don't retry on certain errors
        if (error instanceof Error && (
          error.message.includes('401') ||
          error.message.includes('403') ||
          error.message.includes('404')
        )) {
          break
        }

        // Wait before retry
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Network error',
      code: 'NETWORK_ERROR',
    }
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' }, config)
  }

  async post<T>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(
      endpoint,
      {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      config
    )
  }

  async put<T>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(
      endpoint,
      {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      },
      config
    )
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(
      endpoint,
      {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      },
      config
    )
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' }, config)
  }

  async upload<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, string>,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const formData = new FormData()
    formData.append('file', file)

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value)
      })
    }

    const uploadConfig = {
      ...config,
      headers: {
        ...config?.headers,
        // Don't set Content-Type for FormData, let browser set it
      },
    }

    // Remove Content-Type header for file uploads
    delete uploadConfig.headers?.['Content-Type']

    return this.makeRequest<T>(
      endpoint,
      {
        method: 'POST',
        body: formData,
      },
      uploadConfig
    )
  }
}

// Create singleton instance
export const apiController = new ApiController()

// Convenience functions
export const getData = <T>(endpoint: string, config?: RequestConfig) =>
  apiController.get<T>(endpoint, config)

export const postData = <T>(endpoint: string, data?: any, config?: RequestConfig) =>
  apiController.post<T>(endpoint, data, config)

export const putData = <T>(endpoint: string, data?: any, config?: RequestConfig) =>
  apiController.put<T>(endpoint, data, config)

export const patchData = <T>(endpoint: string, data?: any, config?: RequestConfig) =>
  apiController.patch<T>(endpoint, data, config)

export const deleteData = <T>(endpoint: string, config?: RequestConfig) =>
  apiController.delete<T>(endpoint, config)

export const uploadFile = <T>(
  endpoint: string,
  file: File,
  additionalData?: Record<string, string>,
  config?: RequestConfig
) => apiController.upload<T>(endpoint, file, additionalData, config)

export default apiController