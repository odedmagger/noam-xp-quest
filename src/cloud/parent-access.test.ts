import { describe, expect, it, vi } from 'vitest'
import { authErrorMessage, watchParentState, type ParentState } from './parent-access'

describe('parent authorization', () => {
  it('requires current server approval and handles account changes and sign-out', () => {
    let authHasChanged!: (uid: string | null) => void
    const approvals = new Map<string, (state: ParentState) => void>()
    const stopAuth = vi.fn()
    const stopApproval = vi.fn()
    const emit = vi.fn<(state: ParentState) => void>()
    const cleanup = watchParentState(
      callback => { authHasChanged = callback; return stopAuth },
      (uid, callback) => { approvals.set(uid, callback); return stopApproval },
      emit,
    )
    authHasChanged(null)
    expect(emit).toHaveBeenLastCalledWith('signed-out')
    authHasChanged('first')
    expect(emit).toHaveBeenLastCalledWith('checking')
    approvals.get('first')!('unauthorized')
    expect(emit).toHaveBeenLastCalledWith('unauthorized')
    authHasChanged('second')
    expect(stopApproval).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenLastCalledWith('checking')
    approvals.get('first')!('authorized')
    expect(emit).toHaveBeenLastCalledWith('checking')
    approvals.get('second')!('authorized')
    expect(emit).toHaveBeenLastCalledWith('authorized')
    approvals.get('second')!('unavailable')
    expect(emit).toHaveBeenLastCalledWith('unavailable')
    authHasChanged(null)
    expect(emit).toHaveBeenLastCalledWith('signed-out')
    cleanup()
    expect(stopAuth).toHaveBeenCalledOnce()
    approvals.get('second')!('authorized')
    expect(emit).toHaveBeenLastCalledWith('signed-out')
  })

  it('unsubscribes the current approval listener on cleanup', () => {
    const stopApproval = vi.fn()
    const cleanup = watchParentState(callback => {
      callback('parent')
      return vi.fn()
    }, () => stopApproval, vi.fn())
    cleanup()
    expect(stopApproval).toHaveBeenCalledOnce()
  })

  it('provides a localized message for blocked Google popups', () => {
    expect(authErrorMessage({ code: 'auth/popup-blocked' })).toContain('חלונות קופצים')
  })
})
