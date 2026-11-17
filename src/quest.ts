export type Status = 'pending' | 'achieved' | 'failed'
export const studyAchievementId = 'studied'
export const studyXp = 10
export const gradePolicy = {
  excellent: { xp: 15, medal: 'gold' },
  mastery: { xp: 10, medal: 'silver' },
  competent: { xp: 0, medal: 'bronze' },
  partial: { xp: 0, medal: 'bronze' },
} as const
export type GradeId = keyof typeof gradePolicy
export type Grade = GradeId | 'pending'
export type GradeOption = { id: GradeId; title: string; xp: number; medal: 'gold' | 'silver' | 'bronze' }
export type StudyAchievement = { id: typeof studyAchievementId; title: string; xp: number }
export type Exam = { id: string; subject: string; title?: string; date?: string; icon?: string }
export type Reward = { id: string; title: string; xp: number; description?: string; type?: string; icon?: string }
export type Semester = {
  id: string
  name: string
  startDate?: string
  endDate?: string
  exams: Exam[]
  study: StudyAchievement
  grade: { title: string; pendingTitle: string; options: GradeOption[] }
  rewards: Reward[]
}
export type Config = { activeSemesterId: string; semesters: Semester[] }
export type ExamProgress = { study?: Status; grade?: Grade }
export type Progress = { exams: Record<string, ExamProgress>; claimed: string[] }

export function emptyProgress(): Progress {
  return { exams: {}, claimed: [] }
}

export function isStatus(value: unknown): value is Status {
  return value === 'pending' || value === 'achieved' || value === 'failed'
}

export function isGradeId(value: unknown): value is GradeId {
  return typeof value === 'string' && Object.hasOwn(gradePolicy, value)
}

export function isGrade(value: unknown): value is Grade {
  return value === 'pending' || isGradeId(value)
}

export function maximumExamXp(semester: Semester) {
  return semester.study.xp + Math.max(...semester.grade.options.map(option => option.xp))
}

export function maximumXp(semester: Semester) {
  return semester.exams.length * maximumExamXp(semester)
}

export function changeStudy(progress: Progress, semester: Semester, examId: string, study: Status): Progress {
  if (!semester.exams.some(exam => exam.id === examId)) return progress
  return { ...progress, exams: { ...progress.exams, [examId]: { ...progress.exams[examId], study } } }
}

export function changeGrade(progress: Progress, semester: Semester, examId: string, grade: Grade): Progress {
  if (!semester.exams.some(exam => exam.id === examId)) return progress
  return { ...progress, exams: { ...progress.exams, [examId]: { ...progress.exams[examId], grade } } }
}

export function examXp(progress: Progress, semester: Semester, examId: string) {
  const exam = progress.exams[examId]
  const earnedStudyXp = exam?.study === 'achieved' ? semester.study.xp : 0
  const earnedGradeXp = semester.grade.options.find(option => option.id === exam?.grade)?.xp ?? 0
  return earnedStudyXp + earnedGradeXp
}

export function totalXp(progress: Progress, semester: Semester) {
  return semester.exams.reduce((sum, exam) => sum + examXp(progress, semester, exam.id), 0)
}

export function rewardLadder(semester: Semester, xp: number) {
  const ordered = [...semester.rewards].sort((a, b) => a.xp - b.xp)
  const next = ordered.find(reward => reward.xp > xp)
  const milestone = ordered.filter(reward => reward.xp <= xp).length
  const lowerBound = ordered[milestone - 1]?.xp ?? 0
  const percentage = next ? (xp - lowerBound) / (next.xp - lowerBound) * 100 : ordered.length ? 100 : 0
  return { ordered, next, milestone, percentage }
}

export function canClaim(progress: Progress, reward: Reward, xp: number) {
  return xp >= reward.xp && !progress.claimed.includes(reward.id)
}

export function claimReward(progress: Progress, semester: Semester, rewardId: string): Progress {
  const reward = semester.rewards.find(item => item.id === rewardId)
  if (!reward || !canClaim(progress, reward, totalXp(progress, semester))) return progress
  return { ...progress, claimed: [...progress.claimed, rewardId] }
}
