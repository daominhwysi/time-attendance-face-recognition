import { useState, useEffect, useCallback } from 'react'
import * as facesApi from '@/api/faceApi'
import type { GroupedFace } from '@/api/faceApi'

// No longer need to group on the client, the API does it for us
// type GroupedFaces = Record<string, FaceRecord[]>; // REMOVE THIS

export function useFaceData(pageSize: number = 10) {
  // State now stores the grouped data directly from the API
  const [groupedFaces, setGroupedFaces] = useState<GroupedFace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pagination state is now page-based
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  const fetchFaceGroups = useCallback(
    async (page: number) => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await facesApi.listMyFacesGrouped(page, pageSize)
        setGroupedFaces(data.items)
        setCurrentPage(data.page)
        setTotalPages(Math.ceil(data.total_groups / data.page_size))
      } catch (err) {
        setError('Failed to fetch face groups.')
      } finally {
        setIsLoading(false)
      }
    },
    [pageSize]
  )

  // Function to be called to refresh data (e.g., after upload/delete)
  const refresh = useCallback(() => {
    // Fetches the current page again or resets to the first page
    fetchFaceGroups(currentPage)
  }, [fetchFaceGroups, currentPage])

  // Initial load
  useEffect(() => {
    fetchFaceGroups(1)
  }, [fetchFaceGroups])

  // Function to change page
  const goToPage = (page: number) => {
    if (page > 0 && page <= totalPages) {
      fetchFaceGroups(page)
    }
  }

  // The hook now returns page-related state and functions
  return {
    groupedFaces,
    isLoading,
    error,
    currentPage,
    totalPages,
    goToPage,
    refresh,
  }
}
