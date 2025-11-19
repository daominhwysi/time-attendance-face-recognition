import { useState, useRef } from 'react'
import { Upload, Search as SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as facesApi from '@/api/faceApi'
import type { FaceRecord } from '@/api/faceApi'
import { toast } from 'sonner'
// Import the new hook and components
import { useFaceData } from './hooks/useFaceData'
import { FaceGrid } from './components/FaceGrid'
import { ViewImageModal } from './components/ViewImageModal'
import UploadModal from './components/UploadModal'
import SearchModal from './components/SearchModal'

function ManageFacesPage() {
  // Data logic is now in the custom hook
  const {
    groupedFaces,
    isLoading,
    error,
    currentPage,
    totalPages,
    goToPage,
    refresh,
  } = useFaceData(20)

  // State for modals and UI interactions remains here
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [viewingImage, setViewingImage] = useState<FaceRecord | null>(null)

  // File input refs and state
  const addImageInputRef = useRef<HTMLInputElement>(null)
  const replaceImageInputRef = useRef<HTMLInputElement>(null)
  const [labelToAddImageTo, setLabelToAddImageTo] = useState<string | null>(
    null
  )
  const [pointIdToReplace, setPointIdToReplace] = useState<string | null>(null)

  // Handler functions remain here to connect UI events to API calls and data refreshing
  const handleDelete = async (pointId: string) => {
    // Use a toast with action instead of window.confirm for better UX
    toast("Delete image?", {
        description: "This action cannot be undone.",
        action: {
            label: "Delete",
            onClick: async () => {
                 try {
                    await facesApi.deleteFace(pointId)
                    toast.success("Image deleted")
                    refresh()
                  } catch (err) {
                    toast.error("Failed to delete image")
                  }
            }
        }
    })
  }

  const handleDeletePerson = async (label: string, ids: string[]) => {
    toast(`Delete all images for ${label}?`, {
        description: `This will remove ${ids.length} images.`,
        action: {
            label: "Confirm Delete",
            onClick: async () => {
                try {
                    await Promise.all(ids.map((id) => facesApi.deleteFace(id)))
                    toast.success(`Deleted person: ${label}`)
                    refresh()
                } catch (err) {
                    toast.error(`Failed to delete ${label}`)
                }
            }
        }
    })
  }

  const handleUpdateName = async (pointId: string, oldName: string) => {
    const newName = window.prompt('Enter new name for this group:', oldName)
    if (newName && newName.trim() && newName.trim() !== oldName) {
      try {
        await facesApi.renameFaceGroup(pointId, newName.trim())
        toast.success("Group renamed successfully")
        refresh()
      } catch (err) {
        toast.error("Failed to rename group")
      }
    }
  }

  const handleAddImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && labelToAddImageTo) {
      const loadingToast = toast.loading("Uploading image...")
      try {
        await facesApi.uploadFaces([file], [labelToAddImageTo])
        toast.success("Image added successfully")
        refresh()
      } catch (error) {
        toast.error("Failed to add image")
      } finally {
        toast.dismiss(loadingToast)
        setLabelToAddImageTo(null)
        if (addImageInputRef.current) addImageInputRef.current.value = ''
      }
    }
  }



  const triggerAddImage = (label: string) => {
    setLabelToAddImageTo(label)
    addImageInputRef.current?.click()
  }


  const triggerReplaceImage = (pointId: string) => {
    setPointIdToReplace(pointId)
    replaceImageInputRef.current?.click()
  }

  const handleReplaceImageFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (file && pointIdToReplace) {
      try {
        await facesApi.replaceFaceImage(pointIdToReplace, file)
        alert('Image replaced successfully!')
        refresh() // Tải lại dữ liệu để thấy ảnh mới
      } catch (error) {
        alert(
          'Failed to replace image. Please check if a face is visible in the new photo.'
        )
      } finally {
        if (replaceImageInputRef.current) {
          replaceImageInputRef.current.value = ''
        }
        setPointIdToReplace(null)
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-5 font-sans sm:p-8">
      <header className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Face Datasets</h1>
        <div className="flex gap-2 sm:gap-4">
          <Button onClick={() => setIsUploadModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Upload Faces
          </Button>
          <Button onClick={() => setIsSearchModalOpen(true)} variant="outline">
            <SearchIcon className="mr-2 h-4 w-4" /> Search Face
          </Button>
        </div>
      </header>

      <section>
        <FaceGrid
          isLoading={isLoading}
          error={error}
          groupedFaces={groupedFaces}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          currentPage={currentPage}
          totalPages={totalPages}
          goToPage={goToPage}
          onAddImage={triggerAddImage}
          onUpdateName={handleUpdateName}
          onDelete={handleDelete}
          onDeletePerson={handleDeletePerson}
          onViewImage={setViewingImage}
          onReplaceImage={triggerReplaceImage}
        />
      </section>

      {/* Hidden inputs for file operations */}
      <input
        type="file"
        accept="image/*"
        ref={addImageInputRef}
        onChange={handleAddImageFile}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        ref={replaceImageInputRef}
        onChange={handleReplaceImageFile}
        className="hidden"
      />

      {/* Modals */}
      <UploadModal
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onSuccess={refresh}
      />
      <SearchModal
        open={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
      />
      <ViewImageModal
        image={viewingImage}
        onOpenChange={() => setViewingImage(null)}
      />
    </div>
  )
}

export default ManageFacesPage
