export type LevelTransition = {
  level: number
  target: number
  phase: 'progress' | 'fill' | 'celebrate'
  resetBar: boolean
}

export function startLevelProgress(level: number): LevelTransition {
  return { level, target: level, phase: 'progress', resetBar: false }
}

export function retargetLevel(state: LevelTransition, target: number): LevelTransition {
  if (target <= state.level) return startLevelProgress(target)
  return { ...state, target, phase: state.phase === 'progress' ? 'fill' : state.phase }
}

export function advanceLevel(state: LevelTransition, reached: number): LevelTransition {
  if (state.phase === 'fill') return { ...state, phase: 'celebrate' }
  if (state.phase === 'progress') return state
  return { ...state, level: reached, phase: reached < state.target ? 'fill' : 'progress', resetBar: true }
}
