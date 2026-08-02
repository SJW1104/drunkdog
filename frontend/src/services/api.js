import axios from 'axios'

export const API_TOKEN_KEY = 'suniversity-api-token'
export const API_USER_KEY = 'suniversity-api-user'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000/api/v1',
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(API_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const detail = error.response?.data?.detail
    if (status === 401) {
      localStorage.removeItem(API_TOKEN_KEY)
      localStorage.removeItem(API_USER_KEY)
      window.dispatchEvent(new CustomEvent('suniversity-auth-expired'))
    }
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).filter(Boolean).join('\n')
      : detail || (error.code === 'ECONNABORTED' ? '서버 응답 시간이 초과됐어요.' : '서버와 연결할 수 없어요.')
    error.userMessage = message
    return Promise.reject(error)
  },
)

export function saveApiSession(session) {
  if (!session?.access_token) return
  localStorage.setItem(API_TOKEN_KEY, session.access_token)
  localStorage.setItem(API_USER_KEY, JSON.stringify(session.user || null))
}

export function clearApiSession() {
  localStorage.removeItem(API_TOKEN_KEY)
  localStorage.removeItem(API_USER_KEY)
}

export function getApiErrorMessage(error, fallback = '요청을 처리하지 못했어요.') {
  return error?.userMessage || error?.response?.data?.detail || error?.message || fallback
}

export default apiClient
