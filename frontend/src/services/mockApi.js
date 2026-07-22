import { notificationFixtures, surveyFixtures } from '../mocks/surveys.js'

const wait = (ms = 450) => new Promise((resolve) => window.setTimeout(resolve, ms))

const maybeFail = () => {
  if (window.sessionStorage.getItem('suniversity-force-api-error') === 'true') {
    throw new Error('데이터를 불러오지 못했어요.')
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const mockApi = {
  async getSurveys() {
    await wait()
    maybeFail()
    return clone(surveyFixtures)
  },

  async getNotifications() {
    await wait(300)
    maybeFail()
    return clone(notificationFixtures)
  },

  async submitSurveyResponse(payload) {
    await wait(350)
    maybeFail()
    return { id: Date.now(), reward: payload.reward, submittedAt: new Date().toISOString() }
  },

  async createSurvey(payload) {
    await wait(450)
    maybeFail()
    return { id: Date.now(), ...payload, status: 'reviewing' }
  },
}

export default mockApi