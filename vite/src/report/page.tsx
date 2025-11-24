// frontend/report/page.tsx
'use client'

import * as React from 'react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import {
  ArrowUpDown,
  ListFilter,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  getCustomAttendanceReport,
  type AttendanceRow,
} from '../api/reportsApi'
import { FilterModal, type StatusFilters } from './components/FilterModal'

// --- Helper: Status Calculation ---
const calculateStatus = (row: AttendanceRow, lateThreshold: string | null) => {
  if (!row.first_seen || row.status === 'Absent') return 'Absent'
  if (!lateThreshold) return 'Present'

  const firstSeenDate = new Date(row.first_seen)
  const [limitH, limitM] = lateThreshold.split(':').map(Number)

  const seenTime = firstSeenDate.getHours() * 60 + firstSeenDate.getMinutes()
  const limitTime = limitH * 60 + limitM

  if (seenTime > limitTime) return 'Late'
  return 'Present'
}

// --- Columns ---
const columns: ColumnDef<AttendanceRow & { computedStatus: string }>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Name <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('name')}</div>
    ),
  },
  {
    accessorKey: 'computedStatus',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.computedStatus

      let variant: 'default' | 'secondary' | 'destructive' = 'secondary'
      let className = ''

      if (status === 'Present') {
        variant = 'default'
        className = 'bg-green-600 hover:bg-green-700'
      } else if (status === 'Late') {
        variant = 'secondary'
        className = 'bg-orange-500 text-white hover:bg-orange-600'
      } else {
        variant = 'destructive'
      }

      return (
        <Badge variant={variant} className={className}>
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'first_seen',
    header: 'First Seen',
    cell: ({ row }) => {
      const val = row.getValue('first_seen') as string | null
      if (!val)
        return (
          <span className="text-muted-foreground text-xs italic">--:--</span>
        )
      return (
        <span className="font-mono">
          {new Date(val).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      )
    },
  },
  {
    accessorKey: 'last_seen',
    header: 'Last Seen',
    cell: ({ row }) => {
      const val = row.getValue('last_seen') as string | null
      if (!val)
        return (
          <span className="text-muted-foreground text-xs italic">--:--</span>
        )
      return (
        <span className="font-mono">
          {new Date(val).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      )
    },
  },
  {
    accessorKey: 'total_duration_minutes',
    header: 'Duration (min)',
    cell: ({ row }) => {
      const val = row.getValue('total_duration_minutes') as number
      return <div className="text-center font-mono">{val > 0 ? val : '-'}</div>
    },
  },
]

export function ReportPage() {
  const [sorting, setSorting] = React.useState<SortingState>([])

  // Data States
  const [rawData, setRawData] = React.useState<AttendanceRow[]>([])
  const [processedData, setProcessedData] = React.useState<
    (AttendanceRow & { computedStatus: string })[]
  >([])

  // UI States
  const [isLoading, setIsLoading] = React.useState(false)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  // Filter States
  const [rangeLabel, setRangeLabel] = React.useState<string>('')
  const [currentThreshold, setCurrentThreshold] = React.useState<string | null>(
    null
  )

  // Status Visibility Filters (Default: All true)
  const [statusFilters, setStatusFilters] = React.useState<StatusFilters>({
    showPresent: true,
    showAbsent: true,
    showLate: true,
  })

  // API Call
  const fetchData = async (
    start: Date,
    end: Date,
    lateThreshold: string | null,
    newStatusFilters: StatusFilters
  ) => {
    setIsLoading(true)
    setCurrentThreshold(lateThreshold)
    setStatusFilters(newStatusFilters) // Save the filters

    try {
      const dateStr = `${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}`
      const timeStr = `${start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} -> ${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
      setRangeLabel(`${dateStr} (${timeStr})`)

      const result = await getCustomAttendanceReport(start, end)
      setRawData(result)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // --- Process Data Effect (Calculate Late + Filter Visibility) ---
  React.useEffect(() => {
    // 1. Calculate Status (Present/Late/Absent)
    const calculated = rawData.map((row) => ({
      ...row,
      computedStatus: calculateStatus(row, currentThreshold),
    }))

    // 2. Filter based on Checkboxes
    const filtered = calculated.filter((row) => {
      if (row.computedStatus === 'Present' && !statusFilters.showPresent)
        return false
      if (row.computedStatus === 'Absent' && !statusFilters.showAbsent)
        return false
      if (row.computedStatus === 'Late' && !statusFilters.showLate) return false
      return true
    })

    setProcessedData(filtered)
  }, [rawData, currentThreshold, statusFilters])

  // Initial load
  React.useEffect(() => {
    const start = new Date()
    start.setHours(8, 0, 0, 0)
    const end = new Date()
    end.setHours(17, 0, 0, 0)
    // Pass default filters for initial load
    fetchData(start, end, null, {
      showPresent: true,
      showAbsent: true,
      showLate: true,
    })
  }, [])

  // Table Config
  const table = useReactTable({
    data: processedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    initialState: {
      pagination: { pageSize: 10 },
    },
  })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Access Logs</h1>
          <div className="text-muted-foreground flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center gap-1">
              <CalendarClock className="h-4 w-4" />
              <span>{rangeLabel || 'No range selected'}</span>
            </div>
            {currentThreshold && (
              <Badge
                variant="outline"
                className="w-fit border-orange-200 bg-orange-50 text-orange-600"
              >
                Late threshold: {currentThreshold}
              </Badge>
            )}
          </div>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto"
        >
          <ListFilter className="mr-2 h-4 w-4" /> Filter & Settings
        </Button>
      </div>

      <FilterModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onApply={fetchData}
      />

      <div className="bg-card overflow-hidden rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50">
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
                  className="text-muted-foreground h-32 animate-pulse text-center"
                >
                  Loading data...
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
                  className="text-muted-foreground h-32 text-center"
                >
                  No records found (Check your filters).
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {processedData.length > 0 && !isLoading && (
        <div className="flex items-center justify-between px-2">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="hidden sm:inline">Rows per page</span>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(val) => table.setPageSize(Number(val))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 20, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount()}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
