import { doc, getDocFromServer, onSnapshot, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'
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

export function createFirestoreStore(db: Firestore): ProgressStore {
  const semesterDoc = (semester: Semester) => doc(db, 'semesters', semester.id)

  async function load(semester: Semester): Promise<CloudProgress> {
    const snapshot = await getDocFromServer(semesterDoc(semester))
    return snapshot.exists()
      ? { exists: true, progress: readProgress(semester, decode(snapshot.data())) }
      : { exists: false, progress: emptyProgress() }
  }

  async function transact(semester: Semester, apply: (progress: Progress, data?: RecordData) => RecordData | undefined) {
    const reference = semesterDoc(semester)
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(reference)
      const data = snapshot.exists() ? decode(snapshot.data()) : undefined
      const progress = data ? readProgress(semester, data) : emptyProgress()
      const next = apply(progress, data)
      if (next) transaction.set(reference, { ...next, updatedAt: serverTimestamp() })
    })
  }

  return {
    load,
    subscribe(semester, onEvent) {
      return onSnapshot(semesterDoc(semester), { includeMetadataChanges: true }, snapshot => {
        if (snapshot.metadata.fromCache) {
          onEvent({ kind: 'waiting' })
          return
        }
        if (snapshot.metadata.hasPendingWrites) return
        try {
          const value = snapshot.exists()
            ? { exists: true, progress: readProgress(semester, decode(snapshot.data())) }
            : { exists: false, progress: emptyProgress() }
          onEvent({ kind: 'synced', value })
        } catch {
          onEvent({ kind: 'error' })
        }
      }, () => onEvent({ kind: 'error' }))
    },
    async loadRewardClaims(semester) {
      return (await load(semester)).progress.claimed
    },
    updateAchievement(semester, examId, achievementId, status) {
      if (!isStatus(status)) return Promise.reject(new Error('Invalid achievement status'))
      return transact(semester, (progress, data) => {
        const next = changeAchievement(progress, semester, examId, achievementId, status)
        return next === progress ? undefined : writeProgress(next, data)
      })
    },
    claimReward(semester, rewardId) {
      return transact(semester, (progress, data) => {
        if (progress.claimed.includes(rewardId)) return
        const next = claimReward(progress, semester, rewardId)
        if (next === progress) throw new ProgressConflict('reward-unavailable')
        return writeProgress(next, data)
      })
    },
    importLegacy(semester, legacy) {
      const validated = normalizeProgress(legacy, semester)
      return transact(semester, (_progress, data) => {
        if (data) throw new ProgressConflict('existing-progress')
        return writeProgress(validated)
      })
    },
    reset(semester) {
      return transact(semester, () => writeProgress(emptyProgress()))
    },
  }
}
