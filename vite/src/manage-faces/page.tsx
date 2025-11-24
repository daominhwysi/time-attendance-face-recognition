import { useState } from 'react'
import { Upload, Search as SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FaceProvider } from './context/FaceContext' // Import Provider
import { FaceGrid } from './components/FaceGrid'
import UploadModal from './components/UploadModal'
import SearchModal from './components/SearchModal'

// This component now acts as the layout/container
function ManageFacesContent() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)

  return (
    <div className="mx-auto max-w-7xl p-1 font-sans sm:p-1">
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

      {/* Grid handles its own data via Context */}
      <FaceGrid onOpenUpload={() => setIsUploadModalOpen(true)} />

      {/* Modals - Note: You'll need to update UploadModal to use context too, or pass a refresh callback */}
      <UploadModal
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        // onSuccess is now handled inside UploadModal using context (see below)
        onSuccess={() => {}}
      />
      <SearchModal
        open={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
      />
    </div>
  )
}

export default function ManageFacesPage() {
  return (
    <FaceProvider>
      <ManageFacesContent />
    </FaceProvider>
  )
}
