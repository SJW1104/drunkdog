import { authApi, exchangeApi, notificationApi, surveyApi } from './api.js'

const TYPE_TO_API = {
  short: 'short_text', long: 'long_text', single: 'single_choice', multiple: 'checkboxes',
  dropdown: 'dropdown', scale: 'linear_scale', singleGrid: 'multiple_choice_grid',
  multipleGrid: 'checkbox_grid', date: 'date', time: 'time', file: 'file_upload',
}

const TYPE_FROM_API = Object.fromEntries(Object.entries(TYPE_TO_API).map(([ui, api]) => [api, ui]))

export function toUiSurvey(item) {
  return {
    ...item,
    owner: item.author_nickname || item.author_id,
    questionCount: item.question_count ?? item.questions?.length ?? 0,
    band: item.question_bucket,
    minutes: item.estimated_minutes ?? 1,
    deadline: item.deadline?.slice(0, 10),
    participants: item.response_count ?? 0,
    target: item.target_responses,
    createdAt: item.created_at,
    targetTags: item.category_tags || [],
    mine: Boolean(item.viewer_is_author),
    questions: item.questions?.map((question) => ({
      id: question.id,
      type: TYPE_FROM_API[question.question_type] || question.question_type,
      text: question.prompt,
      description: question.description,
      required: question.required,
      options: question.options?.map((option) => option.label) || [],
      optionRecords: question.options || [],
      rows: question.rows?.map((row) => row.label) || [],
      rowRecords: question.rows || [],
      columns: question.columns?.map((column) => column.label) || [],
      columnRecords: question.columns || [],
      min: question.scale_min,
      max: question.scale_max,
      minLabel: question.scale_min_label,
      maxLabel: question.scale_max_label,
    })),
  }
}

export function toSurveyCreate(ui) {
  return {
    title: ui.title,
    description: ui.description,
    category: ui.category,
    results_visibility: ui.settings?.publicResult ? 'public' : 'after_participation',
    target_responses: ui.target || 100,
    deadline: ui.deadline ? `${ui.deadline}T23:59:59+09:00` : null,
    category_tags: (ui.targetTags || []).slice(0, 3),
    exchange_enabled: true,
    exchange_methods: ['direct', 'auto'],
    exchange_unit: 'individual',
    target_exchange_responses: 1,
    questions: (ui.questions || []).filter((question) => question.type !== 'section').map((question) => ({
      question_type: TYPE_TO_API[question.type] || 'short_text',
      prompt: question.text,
      description: question.description || '',
      required: question.required,
      options: (question.options || []).map((label) => ({ label })),
      rows: (question.rows || []).map((label) => ({ label })),
      columns: (question.columns || []).map((label) => ({ label })),
      scale_min: question.type === 'scale' ? question.min : null,
      scale_max: question.type === 'scale' ? question.max : null,
      scale_min_label: question.minLabel || null,
      scale_max_label: question.maxLabel || null,
    })),
  }
}

export function toAnswers(survey, values) {
  return (survey.questions || []).filter((question) => question.type !== 'section').map((question) => {
    const value = values[question.id]
    const answer = { question_id: question.id }
    if (['short', 'long'].includes(question.type)) answer.value_text = value
    else if (question.type === 'scale') answer.value_number = value
    else if (question.type === 'date') answer.value_date = value
    else if (question.type === 'time') answer.value_time = value
    else if (GRID_TYPES.has(question.type)) {
      answer.grid_answers = Object.fromEntries(Object.entries(value || {}).map(([row, column]) => {
        const rowId = question.rowRecords?.find((item) => item.label === row)?.id || row
        const columnValues = Array.isArray(column) ? column : [column]
        return [rowId, columnValues.map((label) => question.columnRecords?.find((item) => item.label === label)?.id || label)]
      }))
    } else {
      const selected = Array.isArray(value) ? value : [value]
      answer.option_ids = selected.filter(Boolean).map((label) => question.optionRecords?.find((item) => item.label === label)?.id || label)
    }
    return answer
  })
}

const GRID_TYPES = new Set(['singleGrid', 'multipleGrid'])

export async function loadBackendState() {
  await authApi.loginAsDemo()
  const [summaries, exchanges, notificationResult] = await Promise.all([
    surveyApi.getAll({ limit: 100 }), exchangeApi.getAll(), notificationApi.getAll(),
  ])
  const surveys = await Promise.all(summaries.map(async (summary) => {
    try { return toUiSurvey(await surveyApi.getById(summary.id)) } catch { return toUiSurvey(summary) }
  }))
  return {
    surveys,
    exchanges,
    notifications: Array.isArray(notificationResult) ? notificationResult : notificationResult.items || [],
  }
}

export async function createSurveyOnBackend(survey) {
  const draft = await surveyApi.create(toSurveyCreate(survey))
  return toUiSurvey(await surveyApi.publish(draft.id))
}

export async function submitSurveyOnBackend(survey, values, exchangeId) {
  const payload = { answers: toAnswers(survey, values) }
  return exchangeId
    ? exchangeApi.submitResponse(exchangeId, payload)
    : surveyApi.submitResponse(survey.id, payload)
}

export async function startAutoMatchOnBackend(sourceSurveyId) {
  return exchangeApi.enqueueAuto(sourceSurveyId)
}
