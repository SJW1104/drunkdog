import apiClient, { API_TOKEN_KEY, saveApiSession } from './api'

function unwrap(request) {
  return request.then((response) => response.data)
}

function query(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''))
}

const suniversityApi = {
  health: () => unwrap(apiClient.get('/health')),
  universities: () => unwrap(apiClient.get('/universities')),
  requestPhoneOtp: (phone) => unwrap(apiClient.post('/auth/phone/request', { phone })),
  verifyPhoneOtp: async (phone, code) => {
    const session = await unwrap(apiClient.post('/auth/phone/verify', { phone, code }))
    saveApiSession(session)
    return session
  },
  requestUniversityOtp: (universityId, email) => unwrap(apiClient.post('/auth/university/request', { university_id: universityId, email })),
  verifyUniversityOtp: (email, code) => unwrap(apiClient.post('/auth/university/verify', { email, code })),
  devLogin: async (userId = 'demo-author') => {
    const session = await unwrap(apiClient.post('/dev/login', null, { params: { user_id: userId } }))
    saveApiSession(session)
    return session
  },
  ensureDevelopmentSession: async () => {
    if (localStorage.getItem(API_TOKEN_KEY)) return unwrap(apiClient.get('/users/me'))
    if (!import.meta.env.DEV) throw new Error('로그인이 필요해요.')
    return (await suniversityApi.devLogin()).user
  },
  me: () => unwrap(apiClient.get('/users/me')),
  profile: () => unwrap(apiClient.get('/users/me/profile')),
  updateProfile: (payload) => unwrap(apiClient.patch('/users/me/research-profile', payload)),
  surveys: (params) => unwrap(apiClient.get('/surveys', { params: query(params) })),
  survey: (surveyId) => unwrap(apiClient.get(`/surveys/${surveyId}`)),
  categories: () => unwrap(apiClient.get('/survey-categories')),
  mySurveys: (role = 'created', status) => unwrap(apiClient.get('/users/me/surveys', { params: query({ role, status }) })),
  createSurvey: (payload) => unwrap(apiClient.post('/surveys', payload)),
  updateSurvey: (surveyId, payload) => unwrap(apiClient.patch(`/surveys/${surveyId}`, payload)),
  publishSurvey: (surveyId) => unwrap(apiClient.post(`/surveys/${surveyId}/publish`)),
  closeSurvey: (surveyId) => unwrap(apiClient.post(`/surveys/${surveyId}/close`)),
  deleteSurvey: (surveyId) => unwrap(apiClient.delete(`/surveys/${surveyId}`)),
  submitResponse: (surveyId, answers) => unwrap(apiClient.post(`/surveys/${surveyId}/responses`, { answers })),
  results: (surveyId, filters) => unwrap(apiClient.get(`/surveys/${surveyId}/results`, { params: query(filters) })),
  responseTable: (surveyId) => unwrap(apiClient.get(`/surveys/${surveyId}/responses/table`)),
  resultCsv: (surveyId) => unwrap(apiClient.get(`/surveys/${surveyId}/results.csv`, { responseType: 'blob' })),
  dashboard: () => unwrap(apiClient.get('/research/dashboard')),
  shareLink: (surveyId) => unwrap(apiClient.get(`/surveys/${surveyId}/share-link`)),
  rewriteQuestion: (payload) => unwrap(apiClient.post('/ai/questions/rewrite', payload)),
  aiDraft: (payload) => unwrap(apiClient.post('/ai/survey-drafts', payload)),
  recommendations: (surveyId, limit = 20) => unwrap(apiClient.get('/exchanges/recommendations', { params: { survey_id: surveyId, limit } })),
  exchanges: (state) => unwrap(apiClient.get('/exchanges', { params: query({ state }) })),
  directExchange: (payload) => unwrap(apiClient.post('/exchanges/direct', payload)),
  acceptExchange: (exchangeId) => unwrap(apiClient.post(`/exchanges/${exchangeId}/accept`)),
  respondExchange: (exchangeId, answers) => unwrap(apiClient.post(`/exchanges/${exchangeId}/responses`, { answers })),
  rejectExchange: (exchangeId) => unwrap(apiClient.post(`/exchanges/${exchangeId}/reject`)),
  cancelExchange: (exchangeId, reason = '사용자 취소') => unwrap(apiClient.post(`/exchanges/${exchangeId}/cancel`, { reason })),
  autoQueue: (surveyId) => unwrap(apiClient.post('/exchanges/auto/queue', { survey_id: surveyId })),
  autoQueueList: () => unwrap(apiClient.get('/exchanges/auto/queue')),
  reconcileExchanges: () => unwrap(apiClient.post('/exchanges/reconcile')),
  teams: () => unwrap(apiClient.get('/teams')),
  createTeam: (name, memberIds = []) => unwrap(apiClient.post('/teams', { name, member_ids: memberIds })),
  reliability: () => unwrap(apiClient.get('/users/me/reliability')),
  notifications: () => unwrap(apiClient.get('/notifications')),
  readNotification: (notificationId) => unwrap(apiClient.patch(`/notifications/${notificationId}/read`)),
  readAllNotifications: () => unwrap(apiClient.post('/notifications/read-all')),
  toggleBookmark: (surveyId) => unwrap(apiClient.post(`/surveys/${surveyId}/bookmark`)),
  bookmarks: () => unwrap(apiClient.get('/users/me/bookmarks')),
  toggleLike: (surveyId) => unwrap(apiClient.post(`/surveys/${surveyId}/like`)),
  comments: (surveyId) => unwrap(apiClient.get(`/surveys/${surveyId}/comments`)),
  addComment: (surveyId, payload) => unwrap(apiClient.post(`/surveys/${surveyId}/comments`, payload)),
  reportSurvey: (surveyId, reason) => unwrap(apiClient.post('/reports', { target_type: 'survey', target_id: surveyId, reason })),
}

export default suniversityApi
