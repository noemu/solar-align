import React, { useEffect, useState } from "react";

interface DurationSliderProps {
  duration: number; // in Stunden
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export const DurationSlider: React.FC<DurationSliderProps> = ({
  duration,
  onChange,
  min = 0,
  max = 12,
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

  return (
    <div className="w-full px-2 py-2">
      <input
        type="range"
        min={min}
        max={max}
        step={0.25}
        value={duration}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-blue-800">
        <span>Dauer: {getDurationLabel(duration)}</span>
        <span className="text-blue-400">|</span>
        <span>Zeit: {getEndTimeLabel(now, duration)}</span>
      </div>
    </div>
  );
};
