import axios from 'axios'

export const API_TOKEN_KEY = 'suniversity-api-token'
export const API_USER_KEY = 'suniversity-api-user'
const ACCESS_TOKEN_KEY = API_TOKEN_KEY

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearApiSession()
      window.dispatchEvent(new CustomEvent('suniversity-auth-expired'))
    }
    const apiError = new Error(
      error.response?.data?.detail || '서버와 통신하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    )
    apiError.status = error.response?.status
    apiError.code = error.response?.data?.code
    apiError.cause = error
    return Promise.reject(apiError)
  },
)

export const saveAccessToken = (token) => {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export const clearAccessToken = () => {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function saveApiSession(session) {
  if (!session?.access_token) return
  saveAccessToken(session.access_token)
  window.localStorage.setItem(API_USER_KEY, JSON.stringify(session.user || null))
}

export function clearApiSession() {
  clearAccessToken()
  window.localStorage.removeItem(API_USER_KEY)
}

export function getApiErrorMessage(error, fallback = '요청을 처리하지 못했어요.') {
  return error?.userMessage || error?.response?.data?.detail || error?.message || fallback
}

export const healthApi = {
  async check() {
    const { data } = await apiClient.get('/health')
    return data
  },
}

export const authApi = {
  async loginAsDemo(userId = 'demo-student') {
    const { data } = await apiClient.post('/dev/login', null, { params: { user_id: userId } })
    saveAccessToken(data.access_token)
    return data
  },
}

export const surveyApi = {
  async getAll(params = {}) {
    const { data } = await apiClient.get('/surveys', { params })
    return data
  },

  async getById(surveyId) {
    const { data } = await apiClient.get(`/surveys/${surveyId}`)
    return data
  },

  async create(payload) {
    const { data } = await apiClient.post('/surveys', payload)
    return data
  },

  async publish(surveyId) {
    const { data } = await apiClient.post(`/surveys/${surveyId}/publish`)
    return data
  },

  async submitResponse(surveyId, payload) {
    const { data } = await apiClient.post(`/surveys/${surveyId}/responses`, payload)
    return data
  },
}

export const exchangeApi = {
  async getAll(params = {}) {
    const { data } = await apiClient.get('/exchanges', { params })
    return data
  },

  async getRecommendations(surveyId) {
    const { data } = await apiClient.get('/exchanges/recommendations', {
      params: { survey_id: surveyId },
    })
    return data
  },

  async createDirect(payload) {
    const { data } = await apiClient.post('/exchanges/direct', payload)
    return data
  },

  async enqueueAuto(surveyId) {
    const { data } = await apiClient.post('/exchanges/auto/queue', { survey_id: surveyId })
    return data
  },

  async submitResponse(exchangeId, payload) {
    const { data } = await apiClient.post(`/exchanges/${exchangeId}/responses`, payload)
    return data
  },
}

export const notificationApi = {
  async getAll(params = {}) {
    const { data } = await apiClient.get('/notifications', { params })
    return data
  },

  async readAll() {
    const { data } = await apiClient.post('/notifications/read-all')
    return data
  },
}

export default apiClient
