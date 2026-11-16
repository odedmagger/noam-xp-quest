import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type Auth } from 'firebase/auth'
import { doc, onSnapshot, type Firestore } from 'firebase/firestore'

export type ParentState = 'loading' | 'signed-out' | 'checking' | 'authorized' | 'unauthorized' | 'unavailable'

export interface ParentAccess {
  subscribe(onState: (state: ParentState) => void): () => void
  signIn(): Promise<void>
  signOut(): Promise<void>
}

type WatchAuth = (onUser: (uid: string | null) => void) => () => void
type WatchApproval = (uid: string, onState: (state: ParentState) => void) => () => void

export function watchParentState(watchAuth: WatchAuth, watchApproval: WatchApproval, onState: (state: ParentState) => void) {
  let unsubscribeApproval: (() => void) | undefined
  let generation = 0
  let stopped = false
  const unsubscribeAuth = watchAuth(uid => {
    if (stopped) return
    const current = ++generation
    unsubscribeApproval?.()
    unsubscribeApproval = undefined
    if (uid === null) {
      onState('signed-out')
      return
    }
    onState('checking')
    unsubscribeApproval = watchApproval(uid, state => {
      if (generation === current) onState(state)
    })
  })
  return () => {
    stopped = true
    generation++
    unsubscribeApproval?.()
    unsubscribeAuth()
  }
}

export function createFirebaseParentAccess(auth: Auth, db: Firestore): ParentAccess {
  return {
    subscribe(onState) {
      return watchParentState(
        onUser => onAuthStateChanged(auth, user => onUser(user?.uid ?? null)),
        (uid, emit) => onSnapshot(doc(db, 'parents', uid), { includeMetadataChanges: true }, snapshot => {
          if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
            emit('unavailable')
            return
          }
          emit(snapshot.data()?.enabled === true ? 'authorized' : 'unauthorized')
        }, () => emit('unavailable')),
        onState,
      )
    },
    async signIn() {
      // Firebase Auth defaults to local persistence on browsers that support it.
      await signInWithPopup(auth, new GoogleAuthProvider())
    },
    signOut: () => signOut(auth),
  }
}

export function authErrorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  switch (code) {
    case 'auth/popup-blocked': return 'הדפדפן חסם את חלון Google. אפשרו חלונות קופצים ונסו שוב.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request': return 'חלון ההתחברות נסגר. אפשר לנסות שוב.'
    case 'auth/unauthorized-domain': return 'כתובת האתר טרם אושרה להתחברות ב־Firebase.'
    default: return 'לא ניתן להשלים את ההתחברות או ההתנתקות. נסו שוב.'
  }
}
