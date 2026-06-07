import React, { useEffect, useRef } from "react";
import { sensorData, subscribe } from "../hooks/useSensorData";

interface InclinationBarProps {
  targetElevation: number; // Zielneigung (0-90)
}

export const InclinationBar: React.FC<InclinationBarProps> = ({
  targetElevation,
}) => {
  const pointerRef = useRef<HTMLDivElement | null>(null);
  // Für PV ist nur 0..90° relevant.
  const clampedTarget = Math.max(0, Math.min(90, targetElevation));

  const targetPercent = (clampedTarget / 90) * 100;
  const targetPercentInBox = Math.max(8, Math.min(92, targetPercent));

  useEffect(() => {
    let animationFrameId: number;
    let containerHeight = 0;

    const updateLoop = () => {
      if (pointerRef.current && pointerRef.current.parentElement) {
        // Get container height on first call or when it changes
        const container = pointerRef.current.parentElement;
        const newHeight = container.offsetHeight;
        if (newHeight !== containerHeight) {
          containerHeight = newHeight;
        }

        // Read directly from global sensorData
        const clampedCurrent = Math.max(
          0,
          Math.min(90, Math.abs(sensorData.pitch)),
        );

        // 0° flach (unten), 90° senkrecht (oben)
        const currentPercent = (clampedCurrent / 90) * 100;
        const pixelsFromTop = ((100 - currentPercent) / 100) * containerHeight;

        pointerRef.current.style.transform = `translateY(${pixelsFromTop}px)`;
      }
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    // Subscribe to sensor updates
    const unsubscribe = subscribe(updateLoop);

    animationFrameId = requestAnimationFrame(updateLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      unsubscribe();
    };
  }, []);

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
          ref={pointerRef}
          className="absolute left-1 right-1 top-0 transition-[transform] duration-75"
          style={{ willChange: "transform" }}
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
