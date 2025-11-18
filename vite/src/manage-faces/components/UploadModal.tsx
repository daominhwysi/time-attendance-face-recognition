import { useState, useEffect } from 'react'
import * as facesApi from '@/api/faceApi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import Dropzone from './Dropzone'

interface UploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function UploadModal({ open, onOpenChange, onSuccess }: UploadModalProps) {
  const [filesToUpload, setFilesToUpload] = useState<File[]>([])
  const [label, setLabel] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (!open) {
      setFilesToUpload([])
      setLabel('')
      setIsUploading(false)
    }
  }, [open])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (filesToUpload.length === 0 || !label.trim()) {
      alert('Please select files and provide a label.')
      return
    }
    setIsUploading(true)
    try {
      const labelsArray = filesToUpload.map(() => label.trim())
      await facesApi.uploadFaces(filesToUpload, labelsArray)
      alert('Upload successful!')
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      alert('Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload New Faces</DialogTitle>
          <DialogDescription>
            Assign a single label to one or more images. Drag files below or
            click to select.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpload} className="grid gap-4 py-4">
          <Dropzone onFilesSelected={setFilesToUpload} multiple />
          {filesToUpload.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                Selected files ({filesToUpload.length}):
              </h4>
              <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                {filesToUpload.map((file, index) => (
                  <p key={`${file.name}-${index}`}>{file.name}</p>
                ))}
              </div>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-red-600"
                onClick={() => setFilesToUpload([])}
              >
                Clear selection
              </Button>
            </div>
          )}
          <Input
            placeholder="Label for all images (e.g., John Doe)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            disabled={filesToUpload.length === 0}
          />
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                isUploading || filesToUpload.length === 0 || !label.trim()
              }
            >
              {isUploading
                ? 'Uploading...'
                : `Upload ${filesToUpload.length} file(s)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default UploadModal
