import { Loader2, ImageOff, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FaceGroupCard } from './FaceGroupCard'
import { Pagination } from './Pagination'
import { useFaces } from '../context/FaceContext'

interface FaceGridProps {
  onOpenUpload: () => void
}

export function FaceGrid({ onOpenUpload }: FaceGridProps) {
  const { groupedFaces, isLoading, currentPage, totalPages, goToPage } =
    useFaces()

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="text-primary h-10 w-10 animate-spin" />
      </div>
    )
  }

  if (groupedFaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
        <ImageOff className="text-muted-foreground h-12 w-12" />
        <h3 className="mt-4 text-xl font-semibold">No faces found</h3>
        <Button onClick={onOpenUpload} className="mt-6">
          <Upload className="mr-2 h-4 w-4" /> Upload Your First Face
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {groupedFaces.map((group) => (
          <FaceGroupCard key={group.id} group={group} />
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
