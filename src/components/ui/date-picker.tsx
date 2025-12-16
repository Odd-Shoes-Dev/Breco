'use client';

import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { cn } from '@/lib/utils';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  label?: string;
  error?: string;
  value?: Date | string;
  onChange?: (date: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, label, error, value, onChange, minDate, maxDate, id, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() => {
      const date = value ? new Date(value) : new Date();
      return new Date(date.getFullYear(), date.getMonth(), 1);
    });

    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const selectedDate = value ? new Date(value) : undefined;

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const prevMonth = () => {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const selectDate = (day: number) => {
      const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      onChange?.(newDate);
      setIsOpen(false);
    };

    const isDateDisabled = (day: number) => {
      const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;
      return false;
    };

    const isToday = (day: number) => {
      const today = new Date();
      return (
        day === today.getDate() &&
        viewDate.getMonth() === today.getMonth() &&
        viewDate.getFullYear() === today.getFullYear()
      );
    };

    const isSelected = (day: number) => {
      if (!selectedDate) return false;
      return (
        day === selectedDate.getDate() &&
        viewDate.getMonth() === selectedDate.getMonth() &&
        viewDate.getFullYear() === selectedDate.getFullYear()
      );
    };

    const formatDisplayDate = (date: Date) => {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const disabled = isDateDisabled(day);
      days.push(
        <button
          key={day}
          type="button"
          disabled={disabled}
          onClick={() => selectDate(day)}
          className={cn(
            'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
            disabled && 'text-gray-300 cursor-not-allowed',
            !disabled && 'hover:bg-gray-100',
            isToday(day) && !isSelected(day) && 'border border-[#c41e7f] text-[#c41e7f]',
            isSelected(day) && 'bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]'
          )}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="relative">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type="text"
            id={inputId}
            readOnly
            value={selectedDate ? formatDisplayDate(selectedDate) : ''}
            placeholder={props.placeholder || 'Select date'}
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 cursor-pointer pr-10',
              error && 'border-red-500 focus-visible:ring-red-500',
              className
            )}
            {...props}
          />
          <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>

        {isOpen && (
          <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
              </button>
              <span className="text-sm font-semibold text-gray-900">
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <ChevronRightIcon className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div
                  key={day}
                  className="w-8 h-8 flex items-center justify-center text-xs font-medium text-gray-500"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">{days}</div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => {
                  onChange?.(undefined);
                  setIsOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="text-xs text-[#1e3a5f] font-medium hover:text-[#1e3a5f]/80"
                onClick={() => {
                  onChange?.(new Date());
                  setIsOpen(false);
                }}
              >
                Today
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';

// Date range picker
interface DateRangePickerProps {
  label?: string;
  error?: string;
  startDate?: Date;
  endDate?: Date;
  onChange?: (range: { startDate?: Date; endDate?: Date }) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function DateRangePicker({
  label,
  error,
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  className,
}: DateRangePickerProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="flex items-center gap-2">
        <DatePicker
          value={startDate}
          onChange={(date) => onChange?.({ startDate: date, endDate })}
          placeholder="Start date"
          minDate={minDate}
          maxDate={endDate || maxDate}
        />
        <span className="text-gray-400">to</span>
        <DatePicker
          value={endDate}
          onChange={(date) => onChange?.({ startDate, endDate: date })}
          placeholder="End date"
          minDate={startDate || minDate}
          maxDate={maxDate}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

