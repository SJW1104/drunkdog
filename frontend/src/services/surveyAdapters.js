const FRONT_TO_API_TYPE = {
  short: 'short_text',
  long: 'long_text',
  single: 'single_choice',
  multiple: 'checkboxes',
  dropdown: 'dropdown',
  file: 'file_upload',
  scale: 'linear_scale',
  singleGrid: 'multiple_choice_grid',
  multipleGrid: 'checkbox_grid',
  date: 'date',
  time: 'time',
}

const API_TO_FRONT_TYPE = Object.fromEntries(
  Object.entries(FRONT_TO_API_TYPE).map(([front, api]) => [api, front]),
)

Object.assign(API_TO_FRONT_TYPE, {
  single: 'single',
  multiple: 'multiple',
  text: 'long',
  number: 'scale',
  scale: 'scale',
})

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function estimatedTrust(summary) {
  if (typeof summary.author_reliability === 'number') return Math.round(summary.author_reliability)
  return 90
}

export function fromApiQuestion(question) {
  const options = question.options || []
  const rows = question.rows || []
  const columns = question.columns || []
  return {
    id: question.id,
    type: API_TO_FRONT_TYPE[question.question_type] || 'single',
    text: question.prompt,
    description: question.description || '',
    required: question.required,
    options: options.map((option) => option.label),
    optionIds: Object.fromEntries(options.map((option) => [option.label, option.id])),
    rows: rows.map((row) => row.label),
    rowIds: Object.fromEntries(rows.map((row) => [row.label, row.id])),
    columns: columns.map((column) => column.label),
    columnIds: Object.fromEntries(columns.map((column) => [column.label, column.id])),
    min: question.scale_min ?? 1,
    max: question.scale_max ?? 5,
    minLabel: question.scale_min_label || '',
    maxLabel: question.scale_max_label || '',
    minChoices: question.min_choices,
    maxChoices: question.max_choices,
    validationRule: question.validation,
    fileRule: question.file_rule,
  }
}

export function fromApiSurvey(summary) {
  const target = summary.target_responses || Math.max(summary.response_count || 0, 100)
  return {
    id: summary.id,
    api: true,
    createdAt: summary.created_at,
    owner: summary.author_nickname || summary.university_name || 'SUNIVERSITY 사용자',
    trust: estimatedTrust(summary),
    title: summary.title,
    description: summary.description || '설문 설명이 아직 없어요.',
    category: summary.category || '기타',
    questionCount: summary.effective_question_count || summary.question_count || 0,
    band: summary.question_bucket || '문항 미정',
    minutes: summary.estimated_minutes || 1,
    deadline: toDateInput(summary.deadline),
    participants: summary.response_count || 0,
    target,
    matchScore: summary.match_score || 90,
    hot: (summary.like_count || 0) + (summary.response_count || 0) >= 10,
    targetTags: summary.category_tags?.length ? summary.category_tags : ['대학생'],
    mine: Boolean(summary.viewer_is_author),
    completed: Boolean(summary.is_completed),
    favorite: Boolean(summary.is_bookmarked),
    liked: Boolean(summary.is_liked),
    canRespond: Boolean(summary.viewer_can_respond),
    canViewResults: Boolean(summary.viewer_can_view_results),
    status: summary.status,
    exchangeEnabled: Boolean(summary.exchange_enabled),
    exchangeMethods: summary.exchange_methods || [],
    exchangeUnit: summary.exchange_unit || 'individual',
    teamId: summary.team_id,
    responseCount: summary.response_count || 0,
    raw: summary,
    questions: summary.questions?.map(fromApiQuestion),
  }
}

export function fromApiRecommendation(item) {
  return fromApiSurvey({
    ...item,
    id: item.survey_id,
    author_nickname: item.author_name,
    author_reliability: item.reliability,
    effective_question_count: item.question_count,
    match_score: Math.round((item.category_similarity || 0) * 100),
    exchange_enabled: true,
    exchange_methods: ['direct'],
    status: 'published',
  })
}

function cleanLabels(values = []) {
  return values.map((value) => String(value).trim()).filter(Boolean)
}

export function toApiQuestion(question) {
  const questionType = FRONT_TO_API_TYPE[question.type]
  if (!questionType) return null
  const options = cleanLabels(question.options)
  const rows = cleanLabels(question.rows)
  const columns = cleanLabels(question.columns)
  const payload = {
    question_type: questionType,
    prompt: question.text.trim(),
    description: question.description?.trim() || '',
    required: question.required !== false,
  }
  if (['single_choice', 'checkboxes', 'dropdown'].includes(questionType)) {
    payload.options = options.map((label) => ({ label }))
  }
  if (['multiple_choice_grid', 'checkbox_grid'].includes(questionType)) {
    payload.rows = rows.map((label) => ({ label }))
    payload.columns = columns.map((label) => ({ label }))
  }
  if (questionType === 'checkboxes') {
    if (question.minChoices) payload.min_choices = question.minChoices
    if (question.maxChoices) payload.max_choices = question.maxChoices
  }
  if (questionType === 'linear_scale') {
    payload.scale_min = Number(question.min ?? 1)
    payload.scale_max = Number(question.max ?? 5)
    payload.scale_min_label = question.minLabel || null
    payload.scale_max_label = question.maxLabel || null
  }
  if (questionType === 'file_upload') {
    payload.file_rule = question.fileRule || {
      allowed_types: ['application/pdf', 'image/png', 'image/jpeg'],
      max_files: 1,
      max_size_mb: 10,
    }
  }
  if (question.validationRule) payload.validation = question.validationRule
  return payload
}

export function toApiSurveyDraft(survey) {
  if (survey.teamSurvey && !survey.teamId) {
    throw new Error('팀 설문을 게시하려면 먼저 실제 팀을 선택해 주세요.')
  }
  const questions = (survey.questions || [])
    .map(toApiQuestion)
    .filter(Boolean)
  if (!questions.length) throw new Error('게시하려면 질문을 한 개 이상 작성해 주세요.')
  if (questions.some((question) => question.prompt.length < 1)) {
    throw new Error('내용이 비어 있는 질문을 확인해 주세요.')
  }
  const deadline = survey.deadline ? new Date(`${survey.deadline}T23:59:00+09:00`).toISOString() : null
  return {
    title: survey.title,
    description: survey.description || '',
    category: survey.category,
    category_tags: [],
    deadline,
    target_responses: survey.target || 100,
    questions,
    external_access_enabled: true,
    respondent_results_enabled: survey.settings?.publicResult !== false,
    results_visibility: survey.settings?.publicResult === false ? 'private' : 'after_participation',
    exchange_enabled: true,
    exchange_methods: ['direct', 'auto'],
    exchange_unit: survey.teamSurvey ? 'team' : 'individual',
    ...(survey.teamSurvey ? {
      team_id: survey.teamId,
      team_requested_responses: survey.teamRequestedResponses,
    } : {
      target_exchange_responses: 20,
    }),
    auto_repeat: true,
    // 기본 정보 수집 항목은 응답 자격 제한과 다르다. 실제 타깃 값을
    // 사용자가 지정하는 UI가 생기기 전에는 참가자를 임의로 제한하지 않는다.
    required_respondent_conditions: [],
  }
}

export function toApiAnswers(survey, answers) {
  return (survey.questions || [])
    .filter((question) => question.type !== 'section')
    .filter((question) => answers[question.id] !== undefined && answers[question.id] !== '')
    .map((question) => {
      const value = answers[question.id]
      const answer = { question_id: question.id }
      if (['short', 'long'].includes(question.type)) answer.value_text = value
      else if (question.type === 'scale') answer.value_number = Number(value)
      else if (question.type === 'date') answer.value_date = value
      else if (question.type === 'time') answer.value_time = value
      else if (question.type === 'file') {
        throw new Error('파일 업로드 응답은 파일 저장소 연결 후 사용할 수 있어요.')
      } else if (['singleGrid', 'multipleGrid'].includes(question.type)) {
        answer.grid_answers = Object.fromEntries(
          Object.entries(value || {}).map(([row, selected]) => [
            question.rowIds?.[row] || row,
            (Array.isArray(selected) ? selected : [selected]).map((column) => question.columnIds?.[column] || column),
          ]),
        )
      } else {
        const selected = Array.isArray(value) ? value : [value]
        answer.option_ids = selected.map((label) => question.optionIds?.[label] || label)
      }
      return answer
    })
}

export function fromApiExchange(exchange) {
  const mine = exchange.my_survey || {}
  const other = exchange.counterpart_survey || {}
  const stateMap = {
    awaiting_acceptance: exchange.can_accept ? 'incoming' : 'requested',
    in_progress: exchange.can_respond ? 'waiting-me' : 'waiting-partner',
    completed: 'completed',
    rejected: 'rejected',
    cancelled: 'cancelled',
    expired: 'expired',
  }
  const required = 1
  return {
    id: exchange.id,
    api: true,
    type: exchange.scope === 'team' ? '팀 교환' : '개인 교환',
    status: stateMap[exchange.state] || exchange.state,
    surveyId: other.survey_id,
    sourceSurveyId: mine.survey_id,
    title: other.title || '교환 설문',
    partner: exchange.counterpart_name || '상대 설문 작성자',
    people: required,
    ours: Number(exchange.my_response_submitted),
    theirs: exchange.state === 'completed' ? 1 : 0,
    deadline: toDateInput(exchange.cutoff_at),
    deadlineISO: toDateInput(exchange.cutoff_at),
    canAccept: Boolean(exchange.can_accept),
    canRespond: Boolean(exchange.can_respond),
    terminalReason: exchange.terminal_reason,
    raw: exchange,
  }
}

export function fromApiAutoQueue(entry, surveys = []) {
  const source = surveys.find((survey) => survey.id === entry.survey_id)
  return {
    id: `auto-${entry.id}`,
    api: true,
    autoQueue: true,
    type: '자동 매칭',
    status: 'auto-waiting',
    sourceSurveyId: entry.survey_id,
    surveyId: null,
    title: source?.title || '자동 매칭 설문',
    partner: '조건에 맞는 상대를 찾는 중',
    people: source?.exchangeUnit === 'team' ? 2 : 1,
    ours: 0,
    theirs: 0,
    deadline: source?.deadline || '',
    deadlineISO: source?.deadline || '',
    raw: entry,
  }
}

export function fromApiNotification(item) {
  return {
    id: item.id,
    type: item.type || item.notification_type || 'notice',
    title: item.title,
    body: item.body,
    time: item.created_at ? new Date(item.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '방금 전',
    read: Boolean(item.read_at || item.is_read),
    target: item.target,
  }
}
