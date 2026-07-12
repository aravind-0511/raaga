import { useRef, useState } from 'react'
import { UploadCloud, Loader2 } from 'lucide-react'
import { useLibrary } from '../store/libraryStore'
import { ACCEPTED_TYPES } from '../lib/metadata'
import { cn } from '../lib/utils'

export default function UploadDropzone({ compact = false }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const uploading = useLibrary((s) => s.uploading)
  const addFiles = useLibrary((s) => s.addFiles)

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  return (
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
        dragOver ? 'border-accent-hi bg-white/8' : 'border-white/15 hover:border-white/30'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="animate-spin text-accent-hi" size={compact ? 20 : 28} />
          <p className="text-sm text-muted">
            Importing {uploading.done + 1}/{uploading.total}: <span className="text-white/80">{uploading.current}</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <UploadCloud size={compact ? 20 : 32} className="text-accent-hi" />
          <p className={cn('font-medium', compact ? 'text-sm' : '')}>Drop audio or video files here</p>
          {!compact && (
            <p className="text-xs text-muted max-w-sm">
              mp3, wav, ogg, flac, m4a — and any video file (mp4, webm, mkv…). Video files play as audio only.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
