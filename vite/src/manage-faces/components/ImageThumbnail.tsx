import { Eye, Replace, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { FaceRecord } from '@/api/faceApi'

export function ImageThumbnail({
  face,
  onView,
  onReplace,
  onDelete,
}: {
  face: FaceRecord
  onView: (face: FaceRecord) => void
  onReplace: (pointId: string) => void
  onDelete: (pointId: string) => void
}) {
  return (
    <div className="group relative aspect-square">

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
              <img
                src={face.image_url}
                alt={face.name}
                className="h-full w-full rounded-md border object-cover"
              />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(face)}>
              <Eye className="mr-1 h-4 w-4" />
              <span>View</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReplace(face.id)}>
              <Replace className="mr-1 h-4 w-4" />
              <span>Replace</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(face.id)}
              className="text-red-600 focus:text-red-500"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              <span>Delete Image</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
  )
}
