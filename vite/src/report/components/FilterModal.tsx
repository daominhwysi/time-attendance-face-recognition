// frontend/report/components/FilterModal.tsx
import { useState, useEffect } from 'react'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox' // Import Checkbox
import { TimePicker24h } from '@/components/ui/time-picker-24h'

// Định nghĩa kiểu dữ liệu cho bộ lọc trạng thái
export interface StatusFilters {
  showPresent: boolean
  showAbsent: boolean
  showLate: boolean
}

interface FilterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (
    start: Date,
    end: Date,
    lateThreshold: string | null,
    statusFilters: StatusFilters // Thêm tham số này
  ) => void
}

export function FilterModal({ open, onOpenChange, onApply }: FilterModalProps) {
  // Range State
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date())
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date())
  const [timeFrom, setTimeFrom] = useState('08:00')
  const [timeTo, setTimeTo] = useState('17:00')

  // Late Threshold State
  const [enableLateCheck, setEnableLateCheck] = useState(false)
  const [lateTime, setLateTime] = useState('08:30')

  // Status Visibility State (Default: Show all)
  const [statusFilters, setStatusFilters] = useState<StatusFilters>({
    showPresent: true,
    showAbsent: true,
    showLate: true,
  })

  // Popover State
  const [openDateFrom, setOpenDateFrom] = useState(false)
  const [openDateTo, setOpenDateTo] = useState(false)

  useEffect(() => {
    if (open) {
      const now = new Date()
      if (!dateFrom) setDateFrom(now)
      if (!dateTo) setDateTo(now)
    }
  }, [open])

  const handleApply = () => {
    if (!dateFrom || !dateTo) return

    const start = new Date(dateFrom)
    const [startH, startM] = timeFrom.split(':').map(Number)
    start.setHours(startH, startM, 0, 0)

    const end = new Date(dateTo)
    const [endH, endM] = timeTo.split(':').map(Number)
    end.setHours(endH, endM, 59, 999)

    if (end < start) {
      alert('End time must be after Start time')
      return
    }

    const threshold = enableLateCheck ? lateTime : null

    onApply(start, end, threshold, statusFilters)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Report Filters</DialogTitle>
        </DialogHeader>

        <div className="flex w-full flex-col gap-5 py-4">
          {/* 1. DATE RANGE */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                Start Date
              </Label>
              <Popover open={openDateFrom} onOpenChange={setOpenDateFrom}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-between font-normal',
                      !dateFrom && 'text-muted-foreground'
                    )}
                  >
                    {dateFrom
                      ? dateFrom.toLocaleDateString('en-GB')
                      : 'Pick a date'}
                    <CalendarIcon className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => {
                      setDateFrom(d)
                      setOpenDateFrom(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <TimePicker24h value={timeFrom} onChange={setTimeFrom} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label className="text-muted-foreground text-[10px] font-bold uppercase">
                End Date
              </Label>
              <Popover open={openDateTo} onOpenChange={setOpenDateTo}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-between font-normal',
                      !dateTo && 'text-muted-foreground'
                    )}
                  >
                    {dateTo
                      ? dateTo.toLocaleDateString('en-GB')
                      : 'Pick a date'}
                    <CalendarIcon className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => {
                      setDateTo(d)
                      setOpenDateTo(false)
                    }}
                    disabled={dateFrom ? { before: dateFrom } : undefined}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <TimePicker24h value={timeTo} onChange={setTimeTo} />
          </div>

          <Separator />

          {/* 2. LATE SETTINGS */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="late-mode" className="text-sm font-medium">
                Enable Late Check
              </Label>
              <Switch
                id="late-mode"
                checked={enableLateCheck}
                onCheckedChange={setEnableLateCheck}
              />
            </div>

            {enableLateCheck && (
              <div className="bg-muted/30 flex items-center justify-between rounded-md border p-2 px-3 shadow-sm">
                <div className="text-sm">
                  Mark as{' '}
                  <span className="font-bold text-orange-600">Late</span> after:
                </div>
                <TimePicker24h value={lateTime} onChange={setLateTime} />
              </div>
            )}
          </div>

          <Separator />

          {/* 3. STATUS FILTERING (Hide/Show) */}
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-medium">Status Visibility</Label>
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-present"
                  checked={statusFilters.showPresent}
                  onCheckedChange={(v) =>
                    setStatusFilters((prev) => ({
                      ...prev,
                      showPresent: v as boolean,
                    }))
                  }
                />
                <Label
                  htmlFor="show-present"
                  className="cursor-pointer font-normal"
                >
                  Present
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-late"
                  checked={statusFilters.showLate}
                  onCheckedChange={(v) =>
                    setStatusFilters((prev) => ({
                      ...prev,
                      showLate: v as boolean,
                    }))
                  }
                />
                <Label
                  htmlFor="show-late"
                  className="cursor-pointer font-normal"
                >
                  Late
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-absent"
                  checked={statusFilters.showAbsent}
                  onCheckedChange={(v) =>
                    setStatusFilters((prev) => ({
                      ...prev,
                      showAbsent: v as boolean,
                    }))
                  }
                />
                <Label
                  htmlFor="show-absent"
                  className="cursor-pointer font-normal"
                >
                  Absent
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply Filters</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
