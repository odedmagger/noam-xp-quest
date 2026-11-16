import { changeAchievement, emptyProgress, isStatus, type Progress, type Semester } from './quest'

export function serializeProgress(progress: Progress) {
  return JSON.stringify(progress)
}

export function normalizeProgress(value: unknown, semester: Semester): Progress {
  const saved = value as { exams?: Record<string, Record<string, unknown>>; claimed?: unknown } | null
  let progress = emptyProgress()
  for (const exam of semester.exams) {
    // Restore recorded outcomes before enforcing achieved prerequisites.
    for (const item of semester.achievements) {
      const status = saved?.exams?.[exam.id]?.[item.id]
      if (isStatus(status) && status !== 'achieved') {
        progress = changeAchievement(progress, semester, exam.id, item.id, status)
      }
    }
    for (const item of semester.achievements) {
      if (saved?.exams?.[exam.id]?.[item.id] === 'achieved') {
        progress = changeAchievement(progress, semester, exam.id, item.id, 'achieved')
      }
    }
  }
  const claimed: unknown[] = Array.isArray(saved?.claimed) ? saved.claimed : []
  return { ...progress, claimed: semester.rewards.filter(reward => claimed.includes(reward.id)).map(reward => reward.id) }
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
