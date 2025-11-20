'use client'

import * as React from 'react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'

// Import our new API call and type
import { getSightings, type SightingRecord } from '../api/reportsApi'

// Define columns for our new table
export const columns: ColumnDef<SightingRecord>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('name')}</div>
    ),
  },
  {
    accessorKey: 'last_seen_at',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Last Seen
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const dateStr = row.getValue('last_seen_at') as string | null
      if (!dateStr) {
        return <span className="text-muted-foreground">Never</span>
      }
      // Format the date for better readability
      const formatted = new Date(dateStr).toLocaleString()
      return <div>{formatted}</div>
    },
  },
]

type FilterMode = 'all' | 'seen_after' | 'not_seen_since'

export function ReportPage() {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [data, setData] = React.useState<SightingRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // State for our filter controls
  const [filterMode, setFilterMode] = React.useState<FilterMode>('all')
  const [filterDate, setFilterDate] = React.useState('')

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params: { seen_after?: string; not_seen_since?: string } = {}
      if (filterMode !== 'all' && filterDate) {
        const isoDate = new Date(filterDate).toISOString()
        if (filterMode === 'seen_after') {
          params.seen_after = isoDate
        } else if (filterMode === 'not_seen_since') {
          params.not_seen_since = isoDate
        }
      }
      const result = await getSightings(params)
      setData(result)
    } catch (err) {
      setError('Failed to fetch report data.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [filterMode, filterDate])

  // Fetch data on initial load and when filters change
  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  })

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <h1 className="mb-2 text-2xl font-bold">Report</h1>
      <div className="mb-4 flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-4">
          <Label htmlFor="filter-mode">Filter by</Label>
          <select
            id="filter-mode"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="all">Show All</option>
            <option value="seen_after">Seen After Date</option>
            <option value="not_seen_since">Not Seen Since Date</option>
          </select>
        </div>
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="date-filter">Date and Time</Label>
          <Input
            id="date-filter"
            type="datetime-local"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            disabled={filterMode === 'all'}
          />
        </div>
        <Button onClick={fetchData} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Apply Filter'}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Loading data...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-red-500"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results found for the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
