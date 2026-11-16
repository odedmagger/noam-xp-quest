import { authErrorMessage, type ParentAccess, type ParentState } from '../cloud/parent-access'
import { useEffect, useState } from 'react'

export function useParentControls(access: ParentAccess) {
  const [state, setState] = useState<ParentState>('loading')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => access.subscribe(setState), [access])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (reason) {
      setError(authErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  function toggle() {
    setOpen(value => !value)
    setError('')
  }

  return {
    open, busy, error, state, toggle,
    editing: open && state === 'authorized' && !busy,
    signIn: () => run(access.signIn),
    signOut: () => run(access.signOut),
  }
}

export function ParentControls({ controls }: { controls: ReturnType<typeof useParentControls> }) {
  if (!controls.open) return null
  const { state, busy, error, signIn, signOut } = controls
  const messages: Record<ParentState, string> = {
    loading: 'בודק את מצב ההתחברות…',
    'signed-out': 'עריכת התקדמות זמינה להורים מורשים.',
    checking: 'בודק הרשאת הורה…',
    authorized: 'התחברת עם הרשאת הורה.',
    unauthorized: 'החשבון הזה אינו מורשה לערוך. אפשר לצאת ולהתחבר עם חשבון הורה מאושר.',
    unavailable: 'לא ניתן לאמת את הרשאת ההורה כרגע. העריכה מושבתת עד לאימות.',
  }

  return <>
    <div className="banner parent-banner">
      <span role="status">{busy ? 'מעדכן את מצב ההתחברות…' : messages[state]}</span>
      {state === 'signed-out' && <button type="button" disabled={busy} onClick={() => void signIn()}>כניסה עם Google</button>}
      {state !== 'signed-out' && state !== 'loading' &&
        <button type="button" disabled={busy} onClick={() => void signOut()}>התנתקות</button>}
    </div>
    {error && <p className="banner error" role="alert">{error}</p>}
  </>
}
