import { changeAchievement, emptyProgress, isStatus, type Progress, type Semester } from './quest'

export interface ProgressStore {
  load(semester: Semester): Promise<Progress>
  save(semesterId: string, progress: Progress): Promise<void>
  reset(semesterId: string): Promise<void>
}

export function serializeProgress(progress: Progress) {
  return JSON.stringify(progress)
}

export function deserializeProgress(value: string | null, semester: Semester): Progress {
  try {
    const saved = JSON.parse(value ?? '{}')
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
  } catch {
    return emptyProgress()
  }
}

export function storageKey(semesterId: string) {
  return 'noam-xp-quest:v1:' + semesterId
}

export const localProgressStore: ProgressStore = {
  async load(semester) {
    return deserializeProgress(window.localStorage.getItem(storageKey(semester.id)), semester)
  },
  async save(semesterId, progress) {
    window.localStorage.setItem(storageKey(semesterId), serializeProgress(progress))
  },
  async reset(semesterId) {
    window.localStorage.removeItem(storageKey(semesterId))
  },
}
