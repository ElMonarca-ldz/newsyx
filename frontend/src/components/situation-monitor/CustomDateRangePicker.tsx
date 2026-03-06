import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CustomDateRangePickerProps {
    startDate: string | null;
    endDate: string | null;
    onChange: (start: string | null, end: string | null) => void;
}

export function CustomDateRangePicker({ startDate, endDate, onChange }: CustomDateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    // Set to start of day for comparisons
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(0, 0, 0, 0);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calendar logic using native Date
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const daysInMonth = lastDayOfMonth.getDate();
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday

    const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
    const padding = Array.from({ length: startDayOfWeek });

    const handleDayClick = (day: Date) => {
        const clickedDay = new Date(day);
        clickedDay.setHours(0, 0, 0, 0);

        if (!start || (start && end)) {
            onChange(clickedDay.toISOString(), null);
        } else if (clickedDay < start) {
            onChange(clickedDay.toISOString(), null);
        } else {
            onChange(start.toISOString(), clickedDay.toISOString());
            setIsOpen(false);
        }
    };

    const clearRange = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null, null);
    };

    const formatDateDisplay = (dateStr: string | null) => {
        if (!dateStr) return '...';
        return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    const changeMonth = (offset: number) => {
        setViewDate(new Date(year, month + offset, 1));
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    const isWithinRange = (day: Date) => {
        if (!start || !end) return false;
        return day >= start && day <= end;
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-200 border border-zinc-700/50 rounded-lg text-xs transition-all"
            >
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-500" />
                <div className="flex items-center gap-1 font-medium">
                    <span>{formatDateDisplay(startDate)}</span>
                    <span className="text-zinc-600">—</span>
                    <span>{formatDateDisplay(endDate)}</span>
                </div>
                {(startDate || endDate) && (
                    <X className="w-3 h-3 ml-1 text-zinc-500 hover:text-red-400" onClick={clearRange} />
                )}
            </button>

            {isOpen && (
                <div className="absolute top-10 left-0 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-4 z-[2000] animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-zinc-800 rounded">
                            <ChevronLeft className="w-4 h-4 text-zinc-400" />
                        </button>
                        <span className="text-sm font-semibold text-zinc-200 capitalize">
                            {viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-zinc-800 rounded">
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(d => (
                            <div key={d} className="text-[10px] text-center font-bold text-zinc-500 py-1">{d}</div>
                        ))}
                        {padding.map((_, i) => <div key={`p-${i}`} />)}
                        {days.map(day => {
                            const isSelected = (start && isSameDay(day, start)) || (end && isSameDay(day, end));
                            const inRange = isWithinRange(day);

                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => handleDayClick(day)}
                                    className={`
                                        h-8 w-8 text-[11px] rounded-lg transition-all flex items-center justify-center
                                        ${isSelected ? 'bg-emerald-500 text-white font-bold' : ''}
                                        ${inRange && !isSelected ? 'bg-emerald-500/20 text-emerald-400' : ''}
                                        ${!isSelected && !inRange ? 'hover:bg-zinc-800 text-zinc-400' : ''}
                                    `}
                                >
                                    {day.getDate()}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase font-bold tracking-wider transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 uppercase font-bold tracking-wider transition-colors"
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
