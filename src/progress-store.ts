import { emptyProgress, isGrade, isStatus, type Grade, type Progress, type Semester } from './quest'

export function serializeProgress(progress: Progress) {
  return JSON.stringify(progress)
}

export function gradeFromLegacy(excellent: unknown, mastery: unknown): Grade | undefined {
  if (excellent === 'achieved') return 'excellent'
  if (mastery === 'achieved') return 'mastery'
  return isStatus(excellent) || isStatus(mastery) ? 'pending' : undefined
}

export function normalizeProgress(value: unknown, semester: Semester): Progress {
  const saved = value as { exams?: Record<string, Record<string, unknown>>; claimed?: unknown } | null
  const exams: Progress['exams'] = {}
  for (const exam of semester.exams) {
    const entry = saved?.exams?.[exam.id]
    if (!entry) continue
    const study = isStatus(entry.study) ? entry.study : entry[semester.study.id]
    const grade = isGrade(entry.grade) ? entry.grade : gradeFromLegacy(entry.excellent, entry.mastery)
    const outcome = { ...(isStatus(study) && { study }), ...(grade !== undefined && { grade }) }
    if (Object.keys(outcome).length) exams[exam.id] = outcome
  }
  const claimed: unknown[] = Array.isArray(saved?.claimed) ? saved.claimed : []
  return { exams, claimed: semester.rewards.filter(reward => claimed.includes(reward.id)).map(reward => reward.id) }
}

export function deserializeProgress(value: string | null, semester: Semester): Progress {
  try {
    return normalizeProgress(JSON.parse(value ?? '{}'), semester)
  } catch {
    return emptyProgress()
  }
}

export function storageKey(semesterId: string) {
  return 'noam-xp-quest:v1:' + semesterId
}

export function readLegacyProgress(storage: Pick<Storage, 'getItem'>, semester: Semester) {
  const original = storage.getItem(storageKey(semester.id))
  if (original === null) return null
  return parseLegacyProgress(original, semester)
}

function parseLegacyProgress(original: string, semester: Semester) {
  const progress = deserializeProgress(original, semester)
  const hasProgress = Object.keys(progress.exams).length > 0 || progress.claimed.length > 0
  return { original, progress, hasProgress }
}

export function serializeLegacyBackup(semesterId: string, original: string) {
  return JSON.stringify({ semesterId, legacy: original }, null, 2)
}

export function readLegacyBackup(contents: string, semester: Semester) {
  const backup = JSON.parse(contents)
  if (backup?.semesterId !== semester.id || typeof backup.legacy !== 'string') {
    throw new Error('Invalid semester backup')
  }
  const parsed = parseLegacyProgress(backup.legacy, semester)
  if (!parsed.hasProgress) throw new Error('Empty semester backup')
  return parsed
}
