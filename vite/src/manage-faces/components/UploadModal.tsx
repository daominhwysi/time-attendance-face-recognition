// frontend/manage-faces/components/UploadModal.tsx

import { useState, useEffect, useRef } from 'react'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FolderInput, FileImage } from 'lucide-react'
import Dropzone from './Dropzone'
import { useFaces } from '../context/FaceContext'

interface UploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function UploadModal({ open, onOpenChange, onSuccess }: UploadModalProps) {
  const { uploadFaces } = useFaces()

  // State
  const [filesToUpload, setFilesToUpload] = useState<File[]>([])
  const [computedLabels, setComputedLabels] = useState<string[]>([])
  const [manualLabel, setManualLabel] = useState<string>('')

  const [isFolderMode, setIsFolderMode] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Ref for the folder input
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setFilesToUpload([])
      setComputedLabels([])
      setManualLabel('')
      setIsFolderMode(false)
      setIsUploading(false)
    }
  }, [open])

  // --- Logic: Folder Mode File Handling ---
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter((f) =>
        f.type.startsWith('image/')
      )

      // Calculate labels based on parent folder
      const newLabels = selectedFiles.map((file) => {
        // webkitRelativePath example: "MyDataset/JohnDoe/image01.jpg"
        const pathParts = file.webkitRelativePath.split('/')

        // If path has depth (Folder/Subfolder/File), take the 2nd to last item
        if (pathParts.length >= 2) {
          return pathParts[pathParts.length - 2] // "JohnDoe"
        }

        // Fallback for root files or if browser doesn't support path
        return 'Unlabeled'
      })

      setFilesToUpload(selectedFiles)
      setComputedLabels(newLabels)
    }
  }

  // --- Logic: Submit ---
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (filesToUpload.length === 0) {
      alert('Please select files.')
      return
    }
    if (!isFolderMode && !manualLabel.trim()) {
      alert('Please provide a label.')
      return
    }

    setIsUploading(true)
    try {
      // Determine what to pass to Context
      const labelsPayload = isFolderMode ? computedLabels : manualLabel.trim()

      await uploadFaces(filesToUpload, labelsPayload)

      onSuccess()
      onOpenChange(false)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Faces</DialogTitle>
          <DialogDescription>
            Add new faces to your recognition database.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUpload} className="grid gap-6 py-4">
          {/* 1. Mode Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-base">Image Folder Mode</Label>
              <div className="text-muted-foreground text-xs">
                Automatically use folder names as labels (e.g.,{' '}
                <code>/Photos/Batman/img1.jpg</code> → "Batman")
              </div>
            </div>
            <Switch
              checked={isFolderMode}
              onCheckedChange={(checked) => {
                setIsFolderMode(checked)
                setFilesToUpload([]) // Clear files on mode switch
                setComputedLabels([])
              }}
            />
          </div>

          {/* 2. File Input Area */}
          <div>
            {isFolderMode ? (
              <div
                className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center hover:border-blue-500 hover:bg-blue-50"
                onClick={() => folderInputRef.current?.click()}
              >
                <FolderInput className="mx-auto h-10 w-10 text-gray-400" />
                <div className="mt-2 text-sm font-medium text-gray-900">
                  Click to select a root folder
                </div>
                <div className="text-xs text-gray-500">
                  We will recursively find all images inside
                </div>

                {/* Hidden Input with webkitdirectory attribute */}
                <input
                  ref={folderInputRef}
                  type="file"
                  className="hidden"
                  // @ts-ignore - webkitdirectory is non-standard but supported by all major browsers
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFolderSelect}
                />
              </div>
            ) : (
              // Standard Drag & Drop
              <Dropzone onFilesSelected={setFilesToUpload} multiple />
            )}
          </div>

          {/* 3. Stats / File Preview */}
          {filesToUpload.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Selected: {filesToUpload.length} images
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-red-500 hover:text-red-700"
                  onClick={() => {
                    setFilesToUpload([])
                    setComputedLabels([])
                  }}
                >
                  Clear
                </Button>
              </div>

              <div className="bg-muted/30 max-h-28 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                {filesToUpload.slice(0, 10).map((file, i) => (
                  <div key={i} className="flex items-center gap-2 truncate">
                    <FileImage className="h-3 w-3 text-blue-500" />
                    <span className="opacity-70">
                      {isFolderMode ? computedLabels[i] + ' / ' : ''}
                    </span>
                    <span>{file.name}</span>
                  </div>
                ))}
                {filesToUpload.length > 10 && (
                  <div className="pt-1 text-center italic opacity-50">
                    ...and {filesToUpload.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Label Input */}
          <div className="space-y-2">
            <Label htmlFor="face-label">
              {isFolderMode ? 'Labels (Auto-generated)' : 'Label Name'}
            </Label>
            <Input
              id="face-label"
              placeholder={
                isFolderMode ? 'Locked: Using folder names' : 'e.g. John Doe'
              }
              value={isFolderMode ? '' : manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              disabled={isFolderMode} // Locked in folder mode
              className={
                isFolderMode ? 'bg-muted cursor-not-allowed italic' : ''
              }
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                isUploading ||
                filesToUpload.length === 0 ||
                (!isFolderMode && !manualLabel.trim())
              }
            >
              {isUploading ? 'Uploading...' : 'Start Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default UploadModal
