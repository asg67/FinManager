import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
}

const MONTH_NAMES_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toYMD(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function formatDisplay(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

export default function DatePicker({ value, onChange, label }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Determine which month to show based on current value
  const parsed = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  // Sync view when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  // Close on click outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function selectDay(day: number) {
    onChange(toYMD(viewYear, viewMonth, day));
    setOpen(false);
  }

  function selectToday() {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onChange(toYMD(now.getFullYear(), now.getMonth(), now.getDate()));
    setOpen(false);
  }

  // Build calendar grid
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  // Convert Sunday=0 to Monday-based: Mon=0, Tue=1, ..., Sun=6
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const selectedDay = value
    ? (() => {
        const d = new Date(value);
        if (d.getFullYear() === viewYear && d.getMonth() === viewMonth)
          return d.getDate();
        return -1;
      })()
    : -1;

  const today = new Date();
  const todayDay =
    today.getFullYear() === viewYear && today.getMonth() === viewMonth
      ? today.getDate()
      : -1;

  // Build 6 rows x 7 cols
  const cells: { day: number; current: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: daysInPrevMonth - startOffset + 1 + i, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      cells.push({ day: i, current: false });
    }
  }

  return (
    <div className="datepicker" ref={ref}>
      {label && <label className="datepicker__label">{label}</label>}
      <button
        type="button"
        className="datepicker__trigger"
        onClick={() => setOpen(!open)}
      >
        <Calendar size={16} className="datepicker__icon" />
        <span>{formatDisplay(value) || "\u00A0"}</span>
      </button>

      {open && (
        <div className="datepicker__dropdown">
          <div className="datepicker__nav">
            <button type="button" className="datepicker__nav-btn" onClick={prevMonth}>
              <ChevronLeft size={16} />
            </button>
            <span className="datepicker__nav-title">
              {MONTH_NAMES_RU[viewMonth]} {viewYear}
            </span>
            <button type="button" className="datepicker__nav-btn" onClick={nextMonth}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="datepicker__weekdays">
            {WEEKDAYS_RU.map((wd) => (
              <span key={wd} className="datepicker__wd">{wd}</span>
            ))}
          </div>

          <div className="datepicker__grid">
            {cells.map((cell, i) => (
              <button
                key={i}
                type="button"
                className={[
                  "datepicker__cell",
                  !cell.current && "datepicker__cell--outside",
                  cell.current && cell.day === selectedDay && "datepicker__cell--selected",
                  cell.current && cell.day === todayDay && "datepicker__cell--today",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!cell.current}
                onClick={() => cell.current && selectDay(cell.day)}
              >
                {cell.day}
              </button>
            ))}
          </div>

          <div className="datepicker__footer">
            <button type="button" className="datepicker__today-btn" onClick={selectToday}>
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
