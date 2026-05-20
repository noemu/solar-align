import React from "react";

interface CompassProps {
  currentHeading: number;
  targetAzimuth: number;
  isAccurate: boolean;
}

export const Compass: React.FC<CompassProps> = ({
  currentHeading,
  targetAzimuth,
  isAccurate,
}) => {
  const size = 220;
  const center = size / 2;
  const radius = size / 2 - 18;

  // Zielposition auf der rotierenden Scheibe
  const targetAngle = (targetAzimuth * Math.PI) / 180;
  const targetX = center + (radius - 14) * Math.sin(targetAngle);
  const targetY = center - (radius - 14) * Math.cos(targetAngle);

  // Die Scheibe rotiert mit dem Geräte-Heading; die Nadel bleibt fix nach oben.
  const dialRotation = currentHeading;

  return (
    <div className="w-full max-w-[clamp(170px,58vw,300px)] aspect-square flex items-center justify-center">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-md"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill={isAccurate ? "#dcfce7" : "#eef2ff"}
          stroke="#0f172a"
          strokeWidth="2.5"
        />

        <g transform={`rotate(${dialRotation} ${center} ${center})`}>
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i * 10 * Math.PI) / 180;
            const major = i % 9 === 0;
            const x1 = center + (radius - (major ? 12 : 8)) * Math.sin(angle);
            const y1 = center - (radius - (major ? 12 : 8)) * Math.cos(angle);
            const x2 = center + radius * Math.sin(angle);
            const y2 = center - radius * Math.cos(angle);

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#334155"
                strokeWidth={major ? "2" : "1"}
              />
            );
          })}

          <text
            x={center}
            y={center - radius + 22}
            textAnchor="middle"
            className="font-bold text-sm fill-rose-600"
          >
            N
          </text>
          <text
            x={center + radius - 20}
            y={center + 5}
            textAnchor="middle"
            className="font-bold text-sm fill-slate-600"
          >
            E
          </text>
          <text
            x={center}
            y={center + radius - 8}
            textAnchor="middle"
            className="font-bold text-sm fill-slate-600"
          >
            S
          </text>
          <text
            x={center - radius + 20}
            y={center + 5}
            textAnchor="middle"
            className="font-bold text-sm fill-slate-600"
          >
            W
          </text>

          <circle
            cx={targetX}
            cy={targetY}
            r="8"
            fill="#fbbf24"
            stroke="#b45309"
            strokeWidth="2"
          />
          <circle
            cx={targetX}
            cy={targetY}
            r="14"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1"
            opacity="0.45"
          />
        </g>

        <line
          x1={center}
          y1={center - radius + 14}
          x2={center}
          y2={center + 14}
          stroke="#2563eb"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <polygon
          points={`${center},${center - radius + 2} ${center - 10},${center - radius + 20} ${center + 10},${center - radius + 20}`}
          fill="#2563eb"
          stroke="#1e3a8a"
          strokeWidth="1.5"
        />
        <circle cx={center} cy={center} r="5" fill="#0f172a" />
      </svg>
    </div>
  );
};
