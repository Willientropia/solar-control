import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  value?: string; // Formato: "Jan/2026" ou "JAN/2026"
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MONTHS = [
  { value: "JAN", label: "Janeiro" },
  { value: "FEV", label: "Fevereiro" },
  { value: "MAR", label: "Março" },
  { value: "ABR", label: "Abril" },
  { value: "MAI", label: "Maio" },
  { value: "JUN", label: "Junho" },
  { value: "JUL", label: "Julho" },
  { value: "AGO", label: "Agosto" },
  { value: "SET", label: "Setembro" },
  { value: "OUT", label: "Outubro" },
  { value: "NOV", label: "Novembro" },
  { value: "DEZ", label: "Dezembro" },
];

export function MonthPicker({ value, onChange, placeholder = "Selecione o mês", disabled }: MonthPickerProps) {
  const [open, setOpen] = useState(false);

  // Parse current value
  const currentYear = value ? parseInt(value.split("/")[1]) : new Date().getFullYear();
  const currentMonth = value ? value.split("/")[0].toUpperCase() : "";

  const [selectedYear, setSelectedYear] = useState(currentYear);

  const handleMonthSelect = (month: string) => {
    const formattedValue = `${month}/${selectedYear}`;
    onChange(formattedValue);
    setOpen(false);
  };

  const handleYearChange = (delta: number) => {
    setSelectedYear((prev) => prev + delta);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4">
          {/* Year selector */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleYearChange(-1)}
            >
              ▲
            </Button>
            <div className="text-sm font-semibold">{selectedYear}</div>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleYearChange(1)}
            >
              ▼
            </Button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((month) => {
              const isSelected = currentMonth === month.value && currentYear === selectedYear;
              return (
                <Button
                  key={month.value}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-9 text-xs",
                    isSelected && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => handleMonthSelect(month.value)}
                >
                  {month.label.substring(0, 3)}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
