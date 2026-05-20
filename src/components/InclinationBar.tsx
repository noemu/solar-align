import React from "react";

interface InclinationBarProps {
  currentPitch: number; // Aktuelle Neigung (-90 bis 90)
  targetElevation: number; // Zielneigung (0-90)
}

export const InclinationBar: React.FC<InclinationBarProps> = ({
  currentPitch,
  targetElevation,
}) => {
  // Für PV ist nur 0..90° relevant.
  const clampedCurrent = Math.max(0, Math.min(90, Math.abs(currentPitch)));
  const clampedTarget = Math.max(0, Math.min(90, targetElevation));

  // 0° unten, 90° oben
  const currentPercent = (clampedCurrent / 90) * 100;
  const targetPercent = (clampedTarget / 90) * 100;
  const currentPercentInBox = Math.max(2, Math.min(98, currentPercent));
  const targetPercentInBox = Math.max(8, Math.min(92, targetPercent));

  return (
    <div className="h-full w-full flex items-stretch gap-2">
      <div className="h-full min-h-0 flex flex-col justify-between text-[10px] text-slate-700 py-1 font-semibold">
        <span>90°</span>
        <span>60°</span>
        <span>30°</span>
        <span>0°</span>
      </div>

      <div className="relative w-[84px] h-full min-h-0 rounded-lg border-2 border-slate-700 bg-slate-50 shadow-inner overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={`line-${i}`}
            className="absolute left-0 right-0 border-t border-slate-300"
            style={{ top: `${(i * 100) / 9}%` }}
          />
        ))}

        <div
          className="absolute left-1/2 -translate-x-1/2 w-full flex items-center justify-center transition-all duration-200"
          style={{ bottom: `${targetPercentInBox}%` }}
        >
          <div className="w-7 h-7 rounded-full bg-amber-300 border-2 border-amber-700 flex items-center justify-center text-[10px] shadow">
            ☀️
          </div>
        </div>

        <div
          className="absolute left-1 right-1 transition-all duration-200"
          style={{ bottom: `${currentPercentInBox}%` }}
        >
          <div className="flex items-center">
            <div className="w-0 h-0 border-y-[6px] border-y-transparent border-r-[10px] border-r-blue-700" />
            <div className="h-[4px] flex-1 bg-blue-600 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
