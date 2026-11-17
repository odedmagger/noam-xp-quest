import { doc, getDocFromServer, runTransaction, serverTimestamp, type CollectionReference } from 'firebase/firestore'
import { ProgressConflict, type CloudProgress, type ProgressStore } from '../cloud-progress'
import { normalizeProgress } from '../progress-store'
import { claimReward, emptyProgress, isGrade, isStatus, type Grade, type Progress, type Semester, type Status } from '../quest'

type ProgressMaps = {
  statuses: Record<string, Status>
  claims: Record<string, true>
}
type RecordData = ProgressMaps & (
  { schemaVersion: 1; grades?: never } |
  { schemaVersion: 2; grades: Record<string, Grade> }
)
type ProgressPatch = Partial<ProgressMaps> & { grades?: Record<string, Grade> }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decode(data: unknown): RecordData {
  if (!record(data) ||
    !record(data.statuses) || !Object.values(data.statuses).every(isStatus) ||
    !record(data.claims) || !Object.values(data.claims).every(claim => claim === true)) {
    throw new Error('Invalid cloud progress')
  }
  const maps = { statuses: data.statuses as ProgressMaps['statuses'], claims: data.claims as ProgressMaps['claims'] }
  if (data.schemaVersion === 1 && data.grades === undefined) return { ...maps, schemaVersion: 1 }
  if (data.schemaVersion === 2 && record(data.grades) && Object.values(data.grades).every(isGrade)) {
    return { ...maps, schemaVersion: 2, grades: data.grades as Record<string, Grade> }
  }
  throw new Error('Invalid cloud progress')
}

function statusKey(examId: string, achievementId: string) {
  return examId + ':' + achievementId
}

function readProgress(semester: Semester, data: RecordData): Progress {
  const exams = Object.fromEntries(semester.exams.map(({ id }) => [id, {
    study: data.statuses[statusKey(id, semester.study.id)],
    grade: data.grades?.[id],
    excellent: data.statuses[statusKey(id, 'excellent')],
    mastery: data.statuses[statusKey(id, 'mastery')],
  }]))
  return normalizeProgress({ exams, claimed: Object.keys(data.claims) }, semester)
}

function mergeRecord(previous: RecordData | undefined, patch: ProgressPatch): RecordData {
  const maps = {
    statuses: { ...previous?.statuses, ...patch.statuses },
    claims: { ...previous?.claims, ...patch.claims },
  }
  if (previous?.schemaVersion === 2 || patch.grades) {
    return { ...maps, schemaVersion: 2, grades: { ...previous?.grades, ...patch.grades } }
  }
  return { ...maps, schemaVersion: 1 }
}

function importRecord(progress: Progress, semester: Semester): ProgressPatch {
  const statuses: ProgressMaps['statuses'] = {}
  const grades: Record<string, Grade> = {}
  for (const [examId, exam] of Object.entries(progress.exams)) {
    if (exam.study !== undefined) statuses[statusKey(examId, semester.study.id)] = exam.study
    if (exam.grade !== undefined) grades[examId] = exam.grade
  }
  return { statuses, grades, claims: Object.fromEntries(progress.claimed.map(id => [id, true])) }
}

export function createFirestoreStore(semesters: CollectionReference): ProgressStore {
  const semesterDoc = (semester: Semester) => doc(semesters, semester.id)

  async function load(semester: Semester): Promise<CloudProgress> {
    const snapshot = await getDocFromServer(semesterDoc(semester))
    return snapshot.exists()
      ? { exists: true, progress: readProgress(semester, decode(snapshot.data())) }
      : { exists: false, progress: emptyProgress() }
  }

  function transact(semester: Semester, apply: (current: CloudProgress, data?: RecordData) => ProgressPatch | undefined) {
    const reference = semesterDoc(semester)
    return runTransaction(semesters.firestore, async transaction => {
      const snapshot = await transaction.get(reference)
      const data = snapshot.exists() ? decode(snapshot.data()) : undefined
      const current = { exists: !!data, progress: data ? readProgress(semester, data) : emptyProgress() }
      const patch = apply(current, data)
      if (!patch) return current
      const next = mergeRecord(data, patch)
      if (data) {
        const version = patch.grades ? { schemaVersion: 2 } : {}
        transaction.set(reference, { ...patch, ...version, updatedAt: serverTimestamp() }, { merge: true })
      } else {
        transaction.set(reference, { ...next, updatedAt: serverTimestamp() })
      }
      return { exists: true, progress: readProgress(semester, next) }
    })
  }

  return {
    load,
    updateStudy(semester, examId, status) {
      if (!isStatus(status)) return Promise.reject(new Error('Invalid achievement status'))
      if (!semester.exams.some(exam => exam.id === examId)) return Promise.reject(new Error('Unknown exam'))
      return transact(semester, (_, data) => {
        const key = statusKey(examId, semester.study.id)
        if (data?.statuses[key] === status) return
        return { statuses: { [key]: status } }
      })
    },
    updateGrade(semester, examId, grade) {
      if (!isGrade(grade)) return Promise.reject(new Error('Invalid grade'))
      if (!semester.exams.some(exam => exam.id === examId)) return Promise.reject(new Error('Unknown exam'))
      return transact(semester, (_, data) => {
        if (data?.grades?.[examId] === grade) return
        return { grades: { [examId]: grade } }
      })
    },
    claimReward(semester, rewardId) {
      return transact(semester, current => {
        const { progress } = current
        if (progress.claimed.includes(rewardId)) return
        const next = claimReward(progress, semester, rewardId)
        if (next === progress) throw new ProgressConflict('reward-unavailable', current)
        return { claims: { [rewardId]: true } }
      })
    },
    importLegacy(semester, legacy) {
      const validated = normalizeProgress(legacy, semester)
      if (!Object.keys(validated.exams).length && !validated.claimed.length) {
        return Promise.reject(new Error('No valid legacy progress'))
      }
      return transact(semester, (current, data) => {
        if (data) throw new ProgressConflict('existing-progress', current)
        return importRecord(validated, semester)
      })
    },
  }
}
