import React, { useEffect, useRef, useState } from "react";
import { Clock3, Sunrise, Sunset } from "lucide-react";

interface DurationSliderProps {
  selectedDate: Date;
  canGoPreviousDay: boolean;
  onPreviousDay: () => void;
  onNextDay: () => void;
  sunriseTime: Date | null;
  sunsetTime: Date | null;
  startTime: Date | null;
  endTime: Date | null;
  onChangeStartTime: (value: Date) => void;
  onChangeEndTime: (value: Date) => void;
}

export const DurationSlider: React.FC<DurationSliderProps> = ({
  selectedDate,
  canGoPreviousDay,
  onPreviousDay,
  onNextDay,
  sunriseTime,
  sunsetTime,
  startTime,
  endTime,
  onChangeStartTime,
  onChangeEndTime,
}) => {
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [activeThumb, setActiveThumb] = useState<"start" | "end" | null>(null);

  const MINUTES_PER_DAY = 24 * 60;
  const MIN_GAP_MINUTES = 1;

  const getMinutesOfDay = (date: Date) =>
    date.getHours() * 60 + date.getMinutes();

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const minutesToDate = (baseDate: Date, minutes: number) => {
    const next = new Date(baseDate);
    next.setHours(0, 0, 0, 0);
    next.setMinutes(minutes, 0, 0);
    return next;
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDate = (date: Date) =>
    date.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const formatDuration = (minutes: number): string => {
    const safeMinutes = Math.max(0, Math.round(minutes));
    const hrs = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;

    if (hrs === 0) {
      return `${mins}min`;
    }
    if (mins === 0) {
      return `${hrs}h`;
    }
    return `${hrs}h ${mins}min`;
  };

  const sunriseMinutes = sunriseTime ? getMinutesOfDay(sunriseTime) : 0;
  const sunsetMinutes = sunsetTime
    ? getMinutesOfDay(sunsetTime)
    : MINUTES_PER_DAY;
  const safeMinMinutes = Math.max(
    0,
    Math.min(MINUTES_PER_DAY - 1, sunriseMinutes),
  );
  const safeMaxMinutes = Math.max(
    safeMinMinutes + 1,
    Math.min(MINUTES_PER_DAY, sunsetMinutes),
  );

  const startMinutesRaw = startTime
    ? getMinutesOfDay(startTime)
    : safeMinMinutes;
  const endMinutesRaw = endTime ? getMinutesOfDay(endTime) : safeMaxMinutes;
  const startMinutes = clamp(
    startMinutesRaw,
    safeMinMinutes,
    safeMaxMinutes - MIN_GAP_MINUTES,
  );
  const endMinutes = clamp(
    endMinutesRaw,
    startMinutes + MIN_GAP_MINUTES,
    safeMaxMinutes,
  );

  const startPercent =
    ((startMinutes - safeMinMinutes) / (safeMaxMinutes - safeMinMinutes)) * 100;
  const endPercent =
    ((endMinutes - safeMinMinutes) / (safeMaxMinutes - safeMinMinutes)) * 100;
  const durationMinutes = Math.max(0, endMinutes - startMinutes);

  const minutesToPercent = (minutes: number) =>
    ((minutes - safeMinMinutes) / (safeMaxMinutes - safeMinMinutes)) * 100;

  const clientXToMinutes = (clientX: number) => {
    const rect = sliderRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return null;
    }

    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return Math.round(
      safeMinMinutes + ratio * (safeMaxMinutes - safeMinMinutes),
    );
  };

  const updateThumbFromClientX = (clientX: number, thumb: "start" | "end") => {
    const minutes = clientXToMinutes(clientX);
    if (minutes === null) {
      return;
    }

    if (thumb === "start") {
      const nextStartMinutes = clamp(
        minutes,
        safeMinMinutes,
        endMinutes - MIN_GAP_MINUTES,
      );
      onChangeStartTime(minutesToDate(selectedDate, nextStartMinutes));
      return;
    }

    const nextEndMinutes = clamp(
      minutes,
      startMinutes + MIN_GAP_MINUTES,
      safeMaxMinutes,
    );
    onChangeEndTime(minutesToDate(selectedDate, nextEndMinutes));
  };

  useEffect(() => {
    if (activeThumb === null) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      updateThumbFromClientX(event.clientX, activeThumb);
    };

    const handlePointerUp = () => {
      setActiveThumb(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [
    activeThumb,
    endMinutes,
    safeMaxMinutes,
    safeMinMinutes,
    selectedDate,
    startMinutes,
  ]);

  return (
    <div className="w-full px-2 py-2">
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-2 py-1.5 text-slate-900 shadow-sm">
        <button
          type="button"
          onClick={onPreviousDay}
          disabled={!canGoPreviousDay}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Vorheriger Tag"
        >
          ‹
        </button>

        <div className="min-w-0 flex-1 text-center text-sm font-semibold tracking-wide text-slate-800">
          {formatDate(selectedDate)}
        </div>

        <button
          type="button"
          onClick={onNextDay}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-bold text-slate-700"
          aria-label="Nächster Tag"
        >
          ›
        </button>
      </div>

      <div className="relative pt-5 pb-4">
        <div ref={sliderRef} className="relative mx-5 h-8 touch-none">
          <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />

          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blue-600"
            style={{
              left: `${startPercent}%`,
              width: `${Math.max(0, endPercent - startPercent)}%`,
            }}
          />

          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              setActiveThumb("start");
              updateThumbFromClientX(event.clientX, "start");
            }}
            className="absolute top-1/2 z-20 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-800 bg-white shadow-md"
            style={{ left: `${minutesToPercent(startMinutes)}%` }}
            aria-label="Startzeit"
          >
            <span className="sr-only">Startzeit</span>
            <span className="text-[10px] font-bold text-blue-800">1</span>
          </button>

          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              setActiveThumb("end");
              updateThumbFromClientX(event.clientX, "end");
            }}
            className="absolute top-1/2 z-20 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-800 bg-white shadow-md"
            style={{ left: `${minutesToPercent(endMinutes)}%` }}
            aria-label="Endzeit"
          >
            <span className="sr-only">Endzeit</span>
            <span className="text-[10px] font-bold text-blue-800">2</span>
          </button>
        </div>
      </div>

      <div className="mt-2 w-full flex items-center justify-between text-sm font-semibold text-blue-800">
        <span className="inline-flex items-center gap-1">
          <Sunrise size={14} strokeWidth={2.2} />
          <span>{sunriseTime ? formatTime(sunriseTime) : "--:--"}</span>
        </span>
        <span className="text-blue-400">|</span>
        <span>{formatTime(startTime ?? selectedDate)}</span>
        <span className="inline-flex items-center gap-1">
          <Clock3 size={14} strokeWidth={2.2} />
          <span>{formatDuration(durationMinutes)}</span>
        </span>
        <span>{formatTime(endTime ?? selectedDate)}</span>
        <span className="text-blue-400">|</span>
        <span className="inline-flex items-center gap-1">
          <Sunset size={14} strokeWidth={2.2} />
          <span>{sunsetTime ? formatTime(sunsetTime) : "--:--"}</span>
        </span>
      </div>
    </div>
  );
};
