import { Eye, Replace, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useFaces } from '../context/FaceContext'
import type { FaceRecord } from '@/types'
import { useRef, useState } from 'react'

export function ImageThumbnail({ face }: { face: FaceRecord }) {
  const { deleteImage, replaceImage } = useFaces()
  const [isViewOpen, setIsViewOpen] = useState(false)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const handleReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      replaceImage(face.id, e.target.files[0])
    }
  }

  return (
    <>
      {/* This is the ViewImage Modal */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
          <div className="relative flex h-full w-full items-center justify-center">
            <img
              src={face.image_url}
              alt={face.name}
              className="max-h-[90vh] w-auto rounded-md object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>

      <div className="group relative aspect-square">
        <input
          type="file"
          ref={replaceInputRef}
          className="hidden"
          onChange={handleReplace}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <img
              src={face.image_url}
              alt={face.name}
              className="h-full w-full cursor-pointer rounded-md border object-cover select-none hover:opacity-90"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setIsViewOpen(true)
              }}
            >
              <Eye className="mr-1 h-4 w-4" /> View Full
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => replaceInputRef.current?.click()}>
              <Replace className="mr-1 h-4 w-4" /> Replace
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => deleteImage(face.id)}
              className="text-destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete Image
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
