import { MoreHorizontal, Eye, Replace, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      <img
        src={face.image_url}
        alt={face.name}
        className="h-full w-full rounded-md border object-cover"
      />
      <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-6 w-6 rounded-full"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(face)}>
              <Eye className="mr-2 h-4 w-4" />
              <span>View</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReplace(face.id)}>
              <Replace className="mr-2 h-4 w-4" />
              <span>Replace</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(face.id)}
              className="text-red-600 focus:text-red-500"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete Image</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
