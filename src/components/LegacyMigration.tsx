import { useState } from 'react'
import type { CloudProgress } from '../cloud-progress'
import { readLegacyBackup, readLegacyProgress, serializeLegacyBackup } from '../progress-store'
import type { Progress, Semester } from '../quest'

function downloadBackup(semesterId: string, original: string) {
  const contents = serializeLegacyBackup(semesterId, original)
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'noam-xp-quest-' + semesterId + '-local-backup.json'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function LegacyMigration({ semester, snapshot, importAllowed, enabled, onImport }: {
  semester: Semester
  snapshot: CloudProgress
  importAllowed: boolean
  enabled: boolean
  onImport: (progress: Progress) => Promise<boolean>
}) {
  const [local] = useState(() => {
    try {
      return readLegacyProgress(window.localStorage, semester)
    } catch {
      return null
    }
  })
  const [backup, setBackup] = useState<ReturnType<typeof readLegacyBackup> | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [imported, setImported] = useState(false)
  const [error, setError] = useState('')
  const candidate = backup ?? local
  const empty = importAllowed && !snapshot.exists
  const canImport = empty && enabled && candidate?.hasProgress && !imported

  async function pickBackup(file: File) {
    setConfirm(false)
    setError('')
    setBackup(null)
    try {
      setBackup(readLegacyBackup(await file.text(), semester))
    } catch {
      setError('לא ניתן להשתמש בגיבוי הזה. בחרו קובץ תקין של הסמסטר הנוכחי.')
    }
  }

  if (!empty && !candidate && !imported) return null
  return <details className="banner migration">
    <summary>{local ? 'נמצא עותק מקומי של ההתקדמות' : 'ייבוא התקדמות מגיבוי'}</summary>
    {imported ? <p role="status">הייבוא לענן הושלם. העותק המקורי נשמר.</p> :
      !importAllowed ? <p>זהו סמסטר קודם. אפשר להוריד גיבוי של העותק המקומי.</p> :
        snapshot.exists ? <p>כבר קיימת התקדמות בענן לסמסטר הזה. אפשר להוריד גיבוי בלי לשנות את הנתונים בענן.</p> :
          <p>אפשר לייבא התקדמות לסמסטר שהענן עדיין ריק בו. הייבוא שומר על העותק המקורי.</p>}
    <div className="action-banner">
      {local && <button type="button" onClick={() => downloadBackup(semester.id, local.original)}>הורדת גיבוי מקומי</button>}
      {empty && !imported && <label className="backup-picker">
        קובץ גיבוי
        <input type="file" accept=".json,application/json" disabled={!enabled} onChange={event => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void pickBackup(file)
        }} />
      </label>}
      {canImport && !confirm && <button type="button" onClick={() => setConfirm(true)}>
        {backup ? 'ייבוא מקובץ' : 'ייבוא מהדפדפן'}
      </button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {confirm && candidate && empty && <div className="action-banner" role="group" aria-label="אישור ייבוא">
      <span>לייבא את נתוני המבחנים ומסלול ההישגים של {semester.name}?</span>
      <button type="button" onClick={() => setConfirm(false)}>ביטול</button>
      <button type="button" disabled={!canImport} onClick={async () => {
        setConfirm(false)
        if (await onImport(candidate.progress)) setImported(true)
      }}>כן, לייבא</button>
    </div>}
  </details>
}
