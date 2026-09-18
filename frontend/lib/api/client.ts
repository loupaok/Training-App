export const API_BASE_URL = "/api";

export interface ApiRequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

class ApiError extends Error {}

async function request<T = unknown>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(error.message || "API request failed");
  }

  return response.json();
}

export const api = {
  get<T = unknown>(endpoint: string): Promise<T> {
    return request<T>(endpoint);
  },

  post<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    });
  },

  put<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data ?? {}),
    });
  },

  delete<T = unknown>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: "DELETE" });
  },

  async upload<T = unknown>(endpoint: string, formData: FormData, method: "POST" | "PUT" = "POST"): Promise<T> {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
    const headers: Record<string, string> = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      credentials: "include",
      headers,
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(data.message || "Upload failed");
    }

    return data as T;
  },
};
