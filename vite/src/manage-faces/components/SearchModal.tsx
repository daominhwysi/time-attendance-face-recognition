import { useState, useEffect } from 'react'
import * as facesApi from '@/api/faceApi'
import type { SearchResult } from '@/api/faceApi'
import { Search as SearchIcon, FileImage, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import Dropzone from './Dropzone'

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const [searchFile, setSearchFile] = useState<File | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async () => {
    if (!searchFile) {
      alert('Please select an image to search.')
      return
    }
    setIsSearching(true)
    setSearchResults([])
    try {
      const results = await facesApi.searchFaces(searchFile)
      setSearchResults(results)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Search failed.')
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    if (!open) {
      setSearchFile(null)
      setSearchResults([])
      setIsSearching(false)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Search for a Face</DialogTitle>
          <DialogDescription>
            Upload an image to find similar faces in your collection.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!searchFile ? (
            <Dropzone
              onFilesSelected={(files) => setSearchFile(files[0] || null)}
            />
          ) : (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-3">
                <FileImage className="h-6 w-6 text-gray-500" />
                <span className="text-sm font-medium">{searchFile.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSearchFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {isSearching && (
          <div className="p-8 text-center">Searching for matches...</div>
        )}
        {searchResults.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-4 text-xl font-semibold">Search Results:</h3>
            <div className="grid max-h-[40vh] grid-cols-2 gap-4 overflow-y-auto pr-2 md:grid-cols-3 lg:grid-cols-4">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="rounded-lg border bg-gray-50 p-2 text-center"
                >
                  <img
                    src={result.image_url}
                    alt={result.name}
                    className="h-32 w-full rounded-md object-cover"
                  />
                  <p className="mt-2 font-medium">{result.name}</p>
                  <p className="text-sm font-bold text-blue-600">
                    Score: {result.score.toFixed(4)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={handleSearch} disabled={isSearching || !searchFile}>
            <SearchIcon className="mr-2 h-4 w-4" />
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SearchModal
