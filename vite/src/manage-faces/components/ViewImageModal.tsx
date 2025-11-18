import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { FaceRecord } from '@/api/faceApi'

export function ViewImageModal({
  image,
  onOpenChange,
}: {
  image: FaceRecord | null
  onOpenChange: (isOpen: boolean) => void
}) {
  if (!image) return null

  return (
    <Dialog open={!!image} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{image.name}</DialogTitle>
          <DialogDescription>Image ID: {image.id}</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <img
            src={image.image_url}
            alt={`Face of ${image.name}`}
            className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
