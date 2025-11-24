import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  useEffect,
} from 'react'
import { toast } from 'sonner'
import * as faceApi from '@/api/faceApi'
import type { GroupedFace } from '@/types'

interface FaceContextType {
  groupedFaces: GroupedFace[]
  isLoading: boolean
  currentPage: number
  totalPages: number
  itemsOnPage: number

  refresh: (silent?: boolean) => void // Updated signature
  goToPage: (page: number) => void
  uploadFaces: (
    files: File[],
    labelOrLabels: string | string[]
  ) => Promise<void>
  deleteImage: (pointId: string) => Promise<void>
  deleteGroup: (groupId: number, groupName: string) => Promise<void>
  renameGroup: (pointId: string, oldName: string) => Promise<void>
  replaceImage: (pointId: string, file: File) => Promise<void>
}

const FaceContext = createContext<FaceContextType | undefined>(undefined)

export function FaceProvider({ children }: { children: ReactNode }) {
  const [groupedFaces, setGroupedFaces] = useState<GroupedFace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const pageSize = 12
  const itemsOnPage = groupedFaces.length

  // Modified fetchData to accept a 'silent' flag
  const fetchData = useCallback(async (page: number, silent = false) => {
    if (!silent) setIsLoading(true) // Only show spinner if NOT silent
    try {
      const data = await faceApi.listMyFacesGrouped(page, pageSize)
      setGroupedFaces(data.items)
      setCurrentPage(data.page)
      setTotalPages(Math.ceil(data.total_groups / data.page_size))
    } catch (err) {
      toast.error('Failed to load faces')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const refresh = (silent = false) => fetchData(currentPage, silent)
  const goToPage = (page: number) => fetchData(page)

  // --- Actions ---

  const uploadFaces = async (
    files: File[],
    labelOrLabels: string | string[]
  ) => {
    const toastId = toast.loading('Uploading...')
    try {
      let labels: string[]
      if (Array.isArray(labelOrLabels)) {
        labels = labelOrLabels
      } else {
        labels = files.map(() => labelOrLabels)
      }

      const data = await faceApi.uploadFaces(files, labels)

      // Handle warnings
      if (data.failed_uploads && data.failed_uploads.length > 0) {
        const count = data.failed_uploads.length
        const msg =
          count === 1
            ? `No face detected in file: "${data.failed_uploads[0]}"`
            : `No faces detected in ${count} files`
        toast.warning('Upload Warning', { description: msg, duration: 5000 })
      }

      if (data.successful_uploads.length > 0) {
        toast.success(
          `Successfully uploaded ${data.successful_uploads.length} images`
        )
        // SILENT REFRESH: Fetch new data but don't show the spinner
        refresh(true)
      }
    } catch (err) {
      toast.error('Upload failed')
    } finally {
      toast.dismiss(toastId)
    }
  }

  const deleteImage = async (pointId: string) => {
    // 1. Optimistic Update (Instant UI change)
    setGroupedFaces((prevGroups) => {
      return prevGroups
        .map((group) => ({
          ...group,
          // Remove image from the specific group
          images: group.images.filter((img) => img.id !== pointId),
          // Update count
          image_count: group.images.filter((img) => img.id !== pointId).length,
        }))
        .filter((group) => group.images.length > 0) // Remove group if empty
    })

    try {
      await faceApi.deleteFace(pointId)
      toast.success('Image deleted')
      // No refresh needed, state is already correct
    } catch (err) {
      toast.error('Failed to delete image')
      refresh(true) // Revert state on error
    }
  }

  const deleteGroup = async (groupId: number, groupName: string) => {
    // 1. Optimistic Update
    setGroupedFaces((prev) => prev.filter((g) => g.id !== groupId))

    try {
      await faceApi.deleteFaceGroup(groupId)
      toast.success(`Deleted person: ${groupName}`)
    } catch (err) {
      toast.error('Failed to delete person')
      refresh(true)
    }
  }

  const renameGroup = async (pointId: string, oldName: string) => {
    const newName = window.prompt('New name:', oldName)
    if (!newName || newName === oldName) return

    // 1. Optimistic Update
    setGroupedFaces((prev) =>
      prev.map((group) => {
        // Find the group containing this point OR matching the name
        if (group.name === oldName) {
          return { ...group, name: newName }
        }
        return group
      })
    )

    try {
      await faceApi.renameFaceGroup(pointId, newName)
      toast.success('Renamed successfully')
      // We do a silent refresh here because renaming might cause
      // two groups to merge on the backend, which our optimistic logic can't handle perfectly.
      refresh(true)
    } catch (err) {
      toast.error('Rename failed')
      refresh(true)
    }
  }

  const replaceImage = async (pointId: string, file: File) => {
    const toastId = toast.loading('Replacing...')
    try {
      await faceApi.replaceFaceImage(pointId, file)
      toast.success('Image replaced')
      // Must refresh to get the new Image URL from R2
      refresh(true)
    } catch (err) {
      toast.error('Replace failed')
    } finally {
      toast.dismiss(toastId)
    }
  }

  return (
    <FaceContext.Provider
      value={{
        groupedFaces,
        isLoading,
        currentPage,
        totalPages,
        refresh,
        goToPage,
        uploadFaces,
        deleteImage,
        deleteGroup,
        renameGroup,
        replaceImage,
      }}
    >
      {children}
    </FaceContext.Provider>
  )
}

export const useFaces = () => {
  const ctx = useContext(FaceContext)
  if (!ctx) throw new Error('useFaces must be used within FaceProvider')
  return ctx
}
