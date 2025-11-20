import { MoreHorizontal, Plus, Edit, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { FaceRecord } from '@/api/faceApi'
import { ImageThumbnail } from './ImageThumbnail'

// Props definition matches the original
interface FaceGroupCardProps {
  label: string
  faceList: FaceRecord[]
  onAddImage: (label: string) => void
  onUpdateName: (pointId: string, oldName: string) => void
  onDelete: (pointId: string) => void
  onDeletePerson: (label: string, ids: string[]) => void
  onViewImage: (face: FaceRecord) => void
  onReplaceImage: (pointId: string) => void
}

export function FaceGroupCard({
  label,
  faceList,
  ...props
}: FaceGroupCardProps) {
  const firstFaceId = faceList.length > 0 ? faceList[0].id : ''

  return (
    <div className="bg-card text-card-foreground flex flex-col rounded-lg border shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between border-b p-2">
        <div>
          <h2 className="text-muted-foreground text-sm">{label}</h2>

        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => props.onAddImage(label)}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Add Image</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => props.onUpdateName(firstFaceId, label)}
            >
              <Edit className="mr-2 h-4 w-4" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                props.onDeletePerson(
                  label,
                  faceList.map((f) => f.id)
                )
              }
              className="text-red-600 focus:text-red-500"
            >
              <Users className="mr-2 h-4 w-4" />
              <span>Delete Person</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="p-2">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {faceList.map((face) => (
            <ImageThumbnail
              key={face.id}
              face={face}
              onView={props.onViewImage}
              onReplace={props.onReplaceImage}
              onDelete={props.onDelete}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
