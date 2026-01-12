import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface MonthYearPickerProps {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
}

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function MonthYearPicker({ value, onChange, className }: MonthYearPickerProps) {
  const [month, setMonth] = React.useState<string>("");
  const [year, setYear] = React.useState<string>("");

  // Parse initial value
  React.useEffect(() => {
    if (value) {
      const parts = value.split("/");
      if (parts.length === 2) {
        setMonth(parts[0]);
        setYear(parts[1]);
      }
    } else {
        // Default to current month/year if empty? Or keep empty?
        // Better keep empty or let parent control default.
    }
  }, [value]);

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth);
    if (year && newMonth) {
      onChange(`${newMonth}/${year}`);
    } else if (year) {
       // If only year was present, now we have month too? 
       // Actually onChange should probably only fire when valid?
       // Or fire partial? The backend expects "Mmm/YYYY".
       // Let's assume user picks both.
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newYear = e.target.value;
    setYear(newYear);
    // Only update if it's a valid year length? Or on every keystroke?
    // On every keystroke is fine, validation can happen in parent.
    if (month && newYear.length === 4) {
      onChange(`${month}/${newYear}`);
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <Select value={month} onValueChange={handleMonthChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        placeholder="Ano"
        value={year}
        onChange={handleYearChange}
        className="w-[100px]"
      />
    </div>
  );
}
