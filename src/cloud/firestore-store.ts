import { doc, getDocFromServer, runTransaction, serverTimestamp, type CollectionReference } from 'firebase/firestore'
import { ProgressConflict, type CloudProgress, type ProgressStore } from '../cloud-progress'
import { normalizeProgress } from '../progress-store'
import { changeAchievement, claimReward, emptyProgress, isStatus, type Progress, type Semester, type Status } from '../quest'

type RecordData = {
  schemaVersion: 1
  statuses: Record<string, Status>
  claims: Record<string, true>
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decode(data: unknown): RecordData {
  if (!record(data) || data.schemaVersion !== 1 ||
    !record(data.statuses) || !Object.values(data.statuses).every(isStatus) ||
    !record(data.claims) || !Object.values(data.claims).every(claim => claim === true)) {
    throw new Error('Invalid cloud progress')
  }
  return { schemaVersion: 1, statuses: data.statuses as RecordData['statuses'], claims: data.claims as RecordData['claims'] }
}

function statusKey(examId: string, achievementId: string) {
  return examId + ':' + achievementId
}

function readProgress(semester: Semester, data: RecordData): Progress {
  const exams: Progress['exams'] = {}
  for (const exam of semester.exams) {
    for (const item of semester.achievements) {
      const status = data.statuses[statusKey(exam.id, item.id)]
      if (!status) continue
      exams[exam.id] ??= {}
      exams[exam.id][item.id] = status
    }
  }
  return normalizeProgress({ exams, claimed: Object.keys(data.claims) }, semester)
}

function writeProgress(progress: Progress, previous?: RecordData): RecordData {
  const statuses = { ...previous?.statuses }
  const claims = { ...previous?.claims }
  for (const [examId, exam] of Object.entries(progress.exams)) {
    for (const [achievementId, status] of Object.entries(exam)) {
      statuses[statusKey(examId, achievementId)] = status
    }
  }
  for (const rewardId of progress.claimed) claims[rewardId] = true
  return { schemaVersion: 1, statuses, claims }
}

export function createFirestoreStore(semesters: CollectionReference): ProgressStore {
  const semesterDoc = (semester: Semester) => doc(semesters, semester.id)

  async function load(semester: Semester): Promise<CloudProgress> {
    const snapshot = await getDocFromServer(semesterDoc(semester))
    return snapshot.exists()
      ? { exists: true, progress: readProgress(semester, decode(snapshot.data())) }
      : { exists: false, progress: emptyProgress() }
  }

  function transact(semester: Semester, apply: (current: CloudProgress, data?: RecordData) => RecordData | undefined) {
    const reference = semesterDoc(semester)
    return runTransaction(semesters.firestore, async transaction => {
      const snapshot = await transaction.get(reference)
      const data = snapshot.exists() ? decode(snapshot.data()) : undefined
      const current = { exists: !!data, progress: data ? readProgress(semester, data) : emptyProgress() }
      const next = apply(current, data)
      if (!next) return current
      transaction.set(reference, { ...next, updatedAt: serverTimestamp() })
      return { exists: true, progress: readProgress(semester, next) }
    })
  }

  return {
    load,
    updateAchievement(semester, examId, achievementId, status) {
      if (!isStatus(status)) return Promise.reject(new Error('Invalid achievement status'))
      return transact(semester, ({ progress }, data) => {
        const next = changeAchievement(progress, semester, examId, achievementId, status)
        return next === progress ? undefined : writeProgress(next, data)
      })
    },
    claimReward(semester, rewardId) {
      return transact(semester, (current, data) => {
        const { progress } = current
        if (progress.claimed.includes(rewardId)) return
        const next = claimReward(progress, semester, rewardId)
        if (next === progress) throw new ProgressConflict('reward-unavailable', current)
        return writeProgress(next, data)
      })
    },
    importLegacy(semester, legacy) {
      const validated = normalizeProgress(legacy, semester)
      if (!Object.keys(validated.exams).length && !validated.claimed.length) {
        return Promise.reject(new Error('No valid legacy progress'))
      }
      return transact(semester, (current, data) => {
        if (data) throw new ProgressConflict('existing-progress', current)
        return writeProgress(validated)
      })
    },
  }
}
