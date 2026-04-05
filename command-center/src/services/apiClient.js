import env from '@/config/env';

/**
 * ApiClient class for handling HTTP requests using the validated environment configuration.
 * Provides a unified interface for making API calls with proper base URL handling.
 */
class ApiClient {
  constructor() {
    this.baseUrl = env.apiBaseUrl;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Helper to handle fetch requests
   * @param {string} endpoint 
   * @param {object} options 
   * @returns {Promise<any>}
   */
  async request(endpoint, options = {}) {
    // Ensure endpoint starts with / if not present (unless it's a full URL)
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const config = {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        // Attempt to parse error message from JSON, fallback to status text
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // Ignore JSON parse error
        }
        throw new Error(`API Error (${response.status}): ${errorMessage}`);
      }

      // Return null for 204 No Content
      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('API Request Failed:', error);
      throw error;
    }
  }

  /**
   * GET request
   * @param {string} endpoint 
   * @param {object} headers 
   */
  get(endpoint, headers = {}) {
    return this.request(endpoint, { method: 'GET', headers });
  }

  /**
   * POST request
   * @param {string} endpoint 
   * @param {object} body 
   * @param {object} headers 
   */
  post(endpoint, body, headers = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  }

  /**
   * PUT request
   * @param {string} endpoint 
   * @param {object} body 
   * @param {object} headers 
   */
  put(endpoint, body, headers = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers,
    });
  }

  /**
   * DELETE request
   * @param {string} endpoint 
   * @param {object} headers 
   */
  delete(endpoint, headers = {}) {
    return this.request(endpoint, { method: 'DELETE', headers });
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();