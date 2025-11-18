import { useState, useRef, useCallback } from 'react'
import { UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils' // Assuming this path is correct

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void
  className?: string
  multiple?: boolean
}

function Dropzone({
  onFilesSelected,
  className,
  multiple = false,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList) return
    const files = Array.from(fileList)
    if (multiple) {
      onFilesSelected(files)
    } else if (files.length > 0) {
      onFilesSelected([files[0]]) // Always pass an array, but with only one item
    }
  }

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      handleFileSelect(e.dataTransfer.files)
    },
    [onFilesSelected, multiple]
  )

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
  }

  const openFileDialog = () => {
    inputRef.current?.click()
  }

  return (
    <div
      onClick={openFileDialog}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors duration-200 ease-in-out',
        'border-gray-300 text-gray-500 hover:border-blue-500 hover:text-blue-600',
        isDragging && 'border-blue-600 bg-blue-50',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        onChange={onInputChange}
        className="hidden"
        accept="image/*"
      />
      <div className="pointer-events-none flex flex-col items-center justify-center gap-2">
        <UploadCloud className="h-10 w-10" />
        <p className="font-semibold">Click to upload or drag and drop</p>
        <p className="text-sm">
          {multiple ? 'Select multiple files' : 'Select a single file'}
        </p>
      </div>
    </div>
  )
}

export default Dropzone
