import type { Progress, Semester, Status } from './quest'

export type CloudProgress = { progress: Progress; exists: boolean }

export type ProgressEvent =
  | { kind: 'synced'; value: CloudProgress }
  | { kind: 'waiting' }
  | { kind: 'error' }

export interface ProgressStore {
  load(semester: Semester): Promise<CloudProgress>
  subscribe(semester: Semester, onEvent: (event: ProgressEvent) => void): () => void
  loadRewardClaims(semester: Semester): Promise<string[]>
  updateAchievement(semester: Semester, examId: string, achievementId: string, status: Status): Promise<void>
  claimReward(semester: Semester, rewardId: string): Promise<void>
  importLegacy(semester: Semester, legacy: Progress): Promise<void>
  reset(semester: Semester): Promise<void>
}

export class ProgressConflict extends Error {
  constructor(readonly reason: 'existing-progress' | 'reward-unavailable') {
    super(reason)
  }
}
