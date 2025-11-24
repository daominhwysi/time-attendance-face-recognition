import { useRef } from 'react'
import { MoreHorizontal, Plus, Edit, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { ImageThumbnail } from './ImageThumbnail'
import { useFaces } from '../context/FaceContext'
import type { GroupedFace } from '@/types'

export function FaceGroupCard({ group }: { group: GroupedFace }) {
  const { deleteGroup, renameGroup, uploadFaces } = useFaces()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const firstFaceId = group.images.length > 0 ? group.images[0].id : ''

  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadFaces([file], group.name)
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const confirmDelete = () => {
    toast(`Delete ${group.name}?`, {
      description: 'This will remove all associated images and data.',
      action: {
        label: 'Delete',
        onClick: () => deleteGroup(group.id, group.name),
      },
    })
  }

  return (
    <div className="bg-card text-card-foreground flex flex-col rounded-lg border shadow-sm hover:shadow-md">
      {/* Hidden Input for Quick Add */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleAddImage}
      />

      <div className="flex items-center justify-between border-b p-2">
        <h2 className="text-muted-foreground truncate px-2 text-sm font-bold">
          {group.name}
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Plus className="mr-2 h-4 w-4" /> Add Image
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => renameGroup(firstFaceId, group.name)}
            >
              <Edit className="mr-2 h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={confirmDelete}
              className="text-destructive focus:text-destructive"
            >
              <Users className="mr-2 h-4 w-4" /> Delete Person
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="p-2">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {group.images.map((face) => (
            <ImageThumbnail key={face.id} face={face} />
          ))}
        </div>
      </div>
    </div>
  )
}
