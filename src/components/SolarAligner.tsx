import React, { useState, useEffect } from "react";
import { Compass } from "./Compass";
import { InclinationBar } from "./InclinationBar";
import { DurationSlider } from "./DurationSlider";
import { useSensorData } from "../hooks/useSensorData";
import {
  calculateSolarPosition,
  calculateAlignmentError,
  isAlignmentAccurate,
} from "../utils/solarCalculations";

export const SolarAligner: React.FC = () => {
  const { sensorData, headingSource, error, isReady } = useSensorData();
  const [duration, setDuration] = useState(4); // Stunden
  const [targetAzimuth, setTargetAzimuth] = useState(180);
  const [targetElevation, setTargetElevation] = useState(45);
  const [elevationError, setElevationError] = useState(0);
  const [isAccurate, setIsAccurate] = useState(false);
  const [headingOffset, setHeadingOffset] = useState<number | null>(null);

  const normalizeHeading = (angle: number) => ((angle % 360) + 360) % 360;
  const calibrationBaseHeading = sensorData.magneticHeading;
  const canCalibrate = calibrationBaseHeading !== null;
  const effectiveHeading = normalizeHeading(
    headingOffset === null || calibrationBaseHeading === null
      ? sensorData.heading
      : calibrationBaseHeading - headingOffset,
  );

  const handleCalibrate = () => {
    if (!canCalibrate || calibrationBaseHeading === null) {
      return;
    }

    setHeadingOffset(calibrationBaseHeading);
  };

  const handleResetCalibration = () => {
    setHeadingOffset(null);
  };

  // Berechne Solar-Position wenn GPS-Daten vorhanden sind
  useEffect(() => {
    if (
      isReady &&
      sensorData.latitude !== null &&
      sensorData.longitude !== null
    ) {
      const solarPos = calculateSolarPosition({
        latitude: sensorData.latitude,
        longitude: sensorData.longitude,
        duration,
      });

      // Ziel fuer die obere Modulkante: entgegengesetzt zur Sonnenrichtung.
      setTargetAzimuth(normalizeHeading(solarPos.azimuth + 180));
      setTargetElevation(solarPos.tilt);
    }
  }, [isReady, sensorData.latitude, sensorData.longitude, duration]);

  // Berechne Ausrichtungsfehler
  useEffect(() => {
    const errors = calculateAlignmentError(
      effectiveHeading,
      sensorData.pitch,
      targetAzimuth,
      targetElevation,
    );

    setElevationError(errors.elevationError);

    const accurate = isAlignmentAccurate(
      errors.headingError,
      errors.elevationError,
      5,
    );
    setIsAccurate(accurate);
  }, [effectiveHeading, sensorData.pitch, targetAzimuth, targetElevation]);

  return (
    <div
      className="h-dvh box-border overflow-hidden bg-gradient-to-b from-sky-100 via-indigo-50 to-amber-100 px-3 text-slate-900"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
      }}
    >
      <div className="mx-auto h-full w-full max-w-[560px] grid grid-rows-[auto_1fr_auto] gap-2">
        <section className="rounded-2xl bg-white/85 border border-sky-200 shadow-sm px-1 py-2">
          <DurationSlider
            duration={duration}
            onChange={setDuration}
            min={0}
            max={12}
          />
        </section>

        <main className="rounded-2xl bg-white/90 border border-indigo-200 shadow-md p-2 min-h-0 overflow-hidden">
          <div
            className="h-full grid items-center gap-2"
            style={{ gridTemplateColumns: "124px minmax(0, 1fr)" }}
          >
            <div className="h-full min-h-0 border-r border-slate-200 pr-2 flex items-stretch justify-center">
              <InclinationBar
                currentPitch={sensorData.pitch}
                targetElevation={targetElevation}
              />
            </div>

            <div className="min-w-0 h-full min-h-0 flex flex-col items-center">
              <div className="w-full min-h-0 flex-1 flex items-center justify-center">
                <Compass
                  currentHeading={effectiveHeading}
                  targetAzimuth={targetAzimuth}
                  isAccurate={isAccurate && elevationError < 10}
                />
              </div>
              <div className="mt-auto flex w-full items-center justify-center gap-2 px-1 pb-1">
                <button
                  type="button"
                  onClick={handleCalibrate}
                  disabled={!canCalibrate}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]"
                >
                  Calibrate Compass
                </button>
                <button
                  type="button"
                  onClick={handleResetCalibration}
                  disabled={headingOffset === null}
                  className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </main>

        <div className="text-center text-xs text-slate-600 h-4">
          {error
            ? "Sensorfehler"
            : !isReady
              ? "..."
              : !canCalibrate
                ? "Kompass: Ohne Magnetdaten (nur IMU)"
                : headingOffset === null
                  ? `Kompass: Sensor (${headingSource})`
                  : `Kompass: Kalibriert auf Magnet (${headingSource})`}
        </div>
      </div>
    </div>
  );
};
