import React from "react";

interface DurationSliderProps {
  duration: number; // in Stunden
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export const DurationSlider: React.FC<DurationSliderProps> = ({
  duration,
  onChange,
  min = 0.5,
  max = 12,
}) => {
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
      <div className="mt-2 text-center text-lg font-bold text-blue-700">
        {getDurationLabel(duration)}
      </div>
    </div>
  );
};
