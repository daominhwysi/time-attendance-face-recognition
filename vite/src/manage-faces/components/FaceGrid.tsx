import { Loader2, ImageOff, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FaceGroupCard } from './FaceGroupCard'
import { Pagination } from './Pagination' // Import the new component
import type { FaceRecord } from '@/api/faceApi'
import type { GroupedFace } from '@/api/faceApi'

interface FaceGridProps {
  isLoading: boolean
  error: string | null
  groupedFaces: GroupedFace[] // Now receives pre-grouped data
  onOpenUploadModal: () => void
  // Pagination props
  currentPage: number
  totalPages: number
  goToPage: (page: number) => void
  // Pass all handler functions
  onAddImage: (label: string) => void
  onUpdateName: (pointId: string, oldName: string) => void
  onDelete: (pointId: string) => void
  onDeletePerson: (label: string, ids: string[]) => void
  onViewImage: (face: FaceRecord) => void
  onReplaceImage: (pointId: string) => void
}

export function FaceGrid(props: FaceGridProps) {
  const {
    isLoading,
    error,
    groupedFaces,
    onOpenUploadModal,
    currentPage,
    totalPages,
    goToPage,
    ...handlers
  } = props

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="text-primary h-10 w-10 animate-spin" />
      </div>
    )
  }

  if (error) {
    return <p className="p-10 text-center text-red-500">{error}</p>
  }

  if (groupedFaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
        <ImageOff className="text-muted-foreground h-12 w-12" />
        <h3 className="mt-4 text-xl font-semibold">No faces found</h3>
        <Button onClick={onOpenUploadModal} className="mt-6">
          <Upload className="mr-2 h-4 w-4" /> Upload Your First Face
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {groupedFaces.map((group) => (
          <FaceGroupCard
            key={group.name}
            label={group.name}
            faceList={group.images}
            {...handlers}
          />
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
      />
    </div>
  )
}
