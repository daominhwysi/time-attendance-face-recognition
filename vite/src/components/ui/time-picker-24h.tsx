// frontend/components/ui/time-picker-24h.tsx
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TimePicker24hProps {
  value: string // Format "HH:mm"
  onChange: (value: string) => void
}

export function TimePicker24h({ value, onChange }: TimePicker24hProps) {
  const [hour, minute] = value.split(':')
  const hours = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, '0')
  )
  const minutes = Array.from({ length: 60 }, (_, i) =>
    i.toString().padStart(2, '0')
  )

  const handleHourChange = (newHour: string) => {
    onChange(`${newHour}:${minute || '00'}`)
  }

  const handleMinuteChange = (newMinute: string) => {
    onChange(`${hour || '00'}:${newMinute}`)
  }

  return (
    <div className="flex items-center gap-1">
      {/* Hour */}
      <div className="grid gap-1 text-center">
        <Label className="text-muted-foreground text-[10px] uppercase">
          Hour
        </Label>
        <Select value={hour} onValueChange={handleHourChange}>
          <SelectTrigger className="w-[70px]">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent className="h-48">
            {hours.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="text-muted-foreground pt-5 text-lg font-bold">:</span>

      {/* Minute */}
      <div className="grid gap-1 text-center">
        <Label className="text-muted-foreground text-[10px] uppercase">
          Min
        </Label>
        <Select value={minute} onValueChange={handleMinuteChange}>
          <SelectTrigger className="w-[70px]">
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent className="h-48">
            {minutes.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
