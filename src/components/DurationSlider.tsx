import React, { useEffect, useState } from "react";

interface DurationSliderProps {
  duration: number; // in Stunden
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  endTime?: Date | null;
  startTime?: Date | null;
  sunsetTime?: Date | null;
  sunsetDurationHours?: number | null;
  adjustedToSunrise?: boolean;
}

export const DurationSlider: React.FC<DurationSliderProps> = ({
  duration,
  onChange,
  min = 0,
  max = 12,
  endTime = null,
  startTime = null,
  sunsetTime = null,
  sunsetDurationHours = null,
  adjustedToSunrise = false,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => window.clearInterval(timerId);
  }, []);

  const getDurationLabel = (hours: number): string => {
    const mins = Math.round((hours % 1) * 60);
    const hrs = Math.floor(hours);

    if (hrs === 0) {
      return `${mins}min`;
    }
    if (mins === 0) {
      return `${hrs}h`;
    }
    return `${hrs}h ${mins}min`;
  };

  const getEndTimeLabel = (baseDate: Date, hours: number): string => {
    const endDate = new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
    return endDate.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatClock = (date: Date) => {
    return date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const endTimeLabel = endTime
    ? formatClock(endTime)
    : getEndTimeLabel(now, duration);
  const sunriseLabel =
    adjustedToSunrise && startTime
      ? `Sonnenaufgang ${formatClock(startTime)}`
      : null;
  const sunsetLabel = sunsetTime
    ? `Sonnenuntergang ${formatClock(sunsetTime)}`
    : null;
  const hasSunsetSnapPoint =
    sunsetDurationHours !== null &&
    sunsetDurationHours >= min &&
    sunsetDurationHours <= max;
  const sunsetPercent = hasSunsetSnapPoint
    ? ((sunsetDurationHours - min) / (max - min)) * 100
    : null;

  const snapToSunsetIfClose = (value: number) => {
    if (!hasSunsetSnapPoint || sunsetDurationHours === null) {
      return value;
    }

    const snapThresholdHours = 0.2;
    return Math.abs(value - sunsetDurationHours) <= snapThresholdHours
      ? sunsetDurationHours
      : value;
  };

  const handleSliderChange = (rawValue: string) => {
    const value = parseFloat(rawValue);
    if (!Number.isFinite(value)) {
      return;
    }

    onChange(snapToSunsetIfClose(value));
  };

  return (
    <div className="w-full px-2 py-2">
      <div className="relative pt-4">
        {sunsetPercent !== null && (
          <>
            <div
              className="pointer-events-none absolute top-1 h-6 w-0.5 -translate-x-1/2 rounded bg-amber-500"
              style={{ left: `${sunsetPercent}%` }}
            />
            <div
              className="pointer-events-none absolute -top-1 -translate-x-1/2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
              style={{ left: `${sunsetPercent}%` }}
            >
              SU
            </div>
          </>
        )}

        <input
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={duration}
          onChange={(e) => handleSliderChange(e.target.value)}
          className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-blue-800">
        <span>Dauer: {getDurationLabel(duration)}</span>
        <span className="text-blue-400">|</span>
        <span>Zeit: {endTimeLabel}</span>
        {sunsetLabel && (
          <>
            <span className="text-blue-400">|</span>
            <span>{sunsetLabel}</span>
          </>
        )}
        {sunriseLabel && (
          <>
            <span className="text-blue-400">|</span>
            <span>
              {sunriseLabel} + {getDurationLabel(duration)}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
