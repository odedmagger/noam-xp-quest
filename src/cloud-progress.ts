import type { Grade, Progress, Semester, Status } from './quest'

export type CloudProgress = { progress: Progress; exists: boolean }

export interface ProgressStore {
  load(semester: Semester): Promise<CloudProgress>
  updateStudy(semester: Semester, examId: string, status: Status): Promise<CloudProgress>
  updateGrade(semester: Semester, examId: string, grade: Grade): Promise<CloudProgress>
  claimReward(semester: Semester, rewardId: string): Promise<CloudProgress>
  importLegacy(semester: Semester, legacy: Progress): Promise<CloudProgress>
}

export class ProgressConflict extends Error {
  constructor(readonly reason: 'existing-progress' | 'reward-unavailable', readonly current: CloudProgress) {
    super(reason)
  }
}
