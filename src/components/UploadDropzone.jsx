import { useRef, useState } from 'react'
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useLibrary } from '../store/libraryStore'
import { ACCEPTED_TYPES } from '../lib/metadata'
import { Modal } from './ui'
import { cn } from '../lib/utils'

export default function UploadDropzone({ compact = false }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState(null) // { added, skipped } — brief confirmation
  const [dupConfirm, setDupConfirm] = useState(null) // { file, meta, existing, resolve }
  const uploading = useLibrary((s) => s.uploading)
  const addFiles = useLibrary((s) => s.addFiles)

  // Blocks addFiles' loop until the user answers — resolves true to add the
  // duplicate anyway, false to skip it.
  const onDuplicate = ({ file, meta, existing }) =>
    new Promise((resolve) => setDupConfirm({ file, meta, existing, resolve }))

  const answerDuplicate = (proceed) => {
    dupConfirm?.resolve(proceed)
    setDupConfirm(null)
  }

  const run = async (fileList) => {
    setResult(null)
    const res = await addFiles(fileList, { onDuplicate })
    setResult(res)
    setTimeout(() => setResult(null), 6000)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    run(e.dataTransfer.files)
  }

  return (
    <>
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        'glass rounded-2xl border-2 border-dashed cursor-pointer transition text-center',
        compact ? 'p-4' : 'p-10',
        dragOver ? 'border-accent-hi bg-overlay/8' : 'border-overlay/15 hover:border-overlay/30'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => {
          run(e.target.files)
          e.target.value = ''
        }}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="animate-spin text-accent-hi" size={compact ? 20 : 28} />
          <p className="text-sm text-muted">
            Importing {Math.min(uploading.done + 1, uploading.total)}/{uploading.total}:{' '}
            <span className="text-ink/80">{uploading.current}</span>
          </p>
        </div>
      ) : result && (result.added > 0 || result.skipped > 0) ? (
        <div className="flex flex-col items-center gap-1.5">
          {result.added > 0 ? (
            <CheckCircle2 className="text-emerald-400" size={compact ? 20 : 28} />
          ) : (
            <AlertTriangle className="text-amber-400" size={compact ? 20 : 28} />
          )}
          <p className="text-sm font-medium">
            {result.added > 0 ? `Added ${result.added} track${result.added > 1 ? 's' : ''}` : 'Nothing added'}
            {result.skipped > 0 && <span className="text-muted"> · {result.skipped} skipped</span>}
          </p>
          <p className="text-xs text-muted">Tap to add more</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <UploadCloud size={compact ? 20 : 32} className="text-muted" />
          <p className={cn('font-medium', compact ? 'text-sm' : '')}>Drop audio or video files here</p>
          {!compact && (
            <p className="text-xs text-muted max-w-sm">
              mp3, wav, ogg, flac, m4a — and any video file (mp4, webm, mkv…). Video files play as audio only.
            </p>
          )}
        </div>
      )}
    </div>

    <Modal open={!!dupConfirm} onClose={() => answerDuplicate(false)} title="Possible duplicate">
      <p className="text-sm text-muted mb-4">
        <span className="text-ink/85">“{dupConfirm?.file.name}”</span> looks like it's already in your library as{' '}
        <span className="text-ink/85">“{dupConfirm?.existing.title}”</span>. Add it anyway?
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => answerDuplicate(false)}
          className="flex-1 rounded-xl bg-overlay/6 hover:bg-overlay/12 text-ink font-medium py-2.5 transition"
        >
          Skip
        </button>
        <button
          onClick={() => answerDuplicate(true)}
          className="flex-1 rounded-xl bg-accent hover:bg-accent-hi text-white font-medium py-2.5 transition"
        >
          Add anyway
        </button>
      </div>
    </Modal>
    </>
  )
}
