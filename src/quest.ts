export type Status = 'pending' | 'achieved' | 'failed'
export type Achievement = { id: string; title: string; xp: number; requires?: string }
export type Exam = { id: string; subject: string; title?: string; date?: string; icon?: string }
export type Reward = { id: string; title: string; xp: number; description?: string; type?: string; icon?: string }
export type Semester = {
  id: string
  name: string
  startDate?: string
  endDate?: string
  exams: Exam[]
  achievements: Achievement[]
  rewards: Reward[]
}
export type Config = { activeSemesterId: string; semesters: Semester[] }
export type Progress = { exams: Record<string, Record<string, Status>>; claimed: string[] }

export function emptyProgress(): Progress {
  return { exams: {}, claimed: [] }
}

export function isStatus(value: unknown): value is Status {
  return value === 'pending' || value === 'achieved' || value === 'failed'
}

export function maximumXp(semester: Semester) {
  return semester.exams.length * semester.achievements.reduce((sum, item) => sum + item.xp, 0)
}

export function changeAchievement(
  progress: Progress, semester: Semester, examId: string, achievementId: string, status: Status,
): Progress {
  const achievement = semester.achievements.find(item => item.id === achievementId)
  if (!achievement || !semester.exams.some(exam => exam.id === examId)) return progress

  const exam = { ...progress.exams[examId], [achievementId]: status }
  function award(item: Achievement) {
    exam[item.id] = 'achieved'
    const prerequisite = semester.achievements.find(candidate => candidate.id === item.requires)
    if (prerequisite) award(prerequisite)
  }
  function revokeDependents(id: string) {
    for (const dependent of semester.achievements.filter(item => item.requires === id)) {
      if (exam[dependent.id] === 'achieved') exam[dependent.id] = 'pending'
      revokeDependents(dependent.id)
    }
  }

  if (status === 'achieved') award(achievement)
  else revokeDependents(achievementId)
  return { ...progress, exams: { ...progress.exams, [examId]: exam } }
}

export function examXp(progress: Progress, semester: Semester, examId: string) {
  return semester.achievements.reduce((sum, item) => (
    sum + (progress.exams[examId]?.[item.id] === 'achieved' ? item.xp : 0)
  ), 0)
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
