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
  itemsOnCurrentPage: number // <--- 1. NEW VARIABLE

  refresh: (silent?: boolean) => void
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

  // 2. DERIVED STATE: Simply calculate length
  const itemsOnCurrentPage = groupedFaces.length

  const fetchData = useCallback(async (page: number, silent = false) => {
    if (!silent) setIsLoading(true)
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

  // 3. AUTO-PAGINATION EFFECT
  // If we delete the last item on a page (items == 0) and we are not on page 1,
  // automatically go back one page.
  useEffect(() => {
    if (!isLoading && itemsOnCurrentPage === 0) {
      if (currentPage > 1) {
        // Scenario A: We were on Page 5, now it's empty. Go to Page 4.
        goToPage(currentPage - 1)
      } else if (totalPages > 1) {
        // Scenario B: We are on Page 1, it became empty locally,
        // BUT there are other pages (totalPages > 1).
        // The DB has shifted Page 2 items to Page 1. We must fetch them.
        refresh(true) // Silent refresh to pull items from the "queue"
      }
    }
  }, [itemsOnCurrentPage, isLoading, currentPage])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const refresh = (silent = false) => fetchData(currentPage, silent)
  const goToPage = (page: number) => fetchData(page)

  const uploadFaces = async (
    files: File[],
    labelOrLabels: string | string[]
  ) => {
    const toastId = toast.loading('Uploading...')
    try {
      let labels: string[] = Array.isArray(labelOrLabels)
        ? labelOrLabels
        : files.map(() => labelOrLabels)
      const data = await faceApi.uploadFaces(files, labels)

      if (data.failed_uploads?.length > 0) {
        toast.warning(`No faces found in ${data.failed_uploads.length} files`)
      }

      if (data.successful_uploads.length > 0) {
        toast.success(`Uploaded ${data.successful_uploads.length} images`)
        refresh(true)
      }
    } catch (err) {
      toast.error('Upload failed')
    } finally {
      toast.dismiss(toastId)
    }
  }

  const deleteImage = async (pointId: string) => {
    setGroupedFaces((prevGroups) => {
      return prevGroups
        .map((group) => ({
          ...group,
          images: group.images.filter((img) => img.id !== pointId),
          image_count: group.images.filter((img) => img.id !== pointId).length,
        }))
        .filter((group) => group.images.length > 0)
    })

    try {
      await faceApi.deleteFace(pointId)
      toast.success('Image deleted')
    } catch (err) {
      toast.error('Failed to delete image')
      refresh(true)
    }
  }

  const deleteGroup = async (groupId: number, groupName: string) => {
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

    setGroupedFaces((prev) =>
      prev.map((group) =>
        group.name === oldName ? { ...group, name: newName } : group
      )
    )

    try {
      await faceApi.renameFaceGroup(pointId, newName)
      toast.success('Renamed successfully')
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
        itemsOnCurrentPage, // <--- EXPOSED HERE
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
