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
  const { sensorData, error, isReady } = useSensorData();
  const [duration, setDuration] = useState(4); // Stunden
  const [targetAzimuth, setTargetAzimuth] = useState(180);
  const [targetElevation, setTargetElevation] = useState(45);
  const [elevationError, setElevationError] = useState(0);
  const [isAccurate, setIsAccurate] = useState(false);

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

      setTargetAzimuth(solarPos.azimuth);
      setTargetElevation(solarPos.tilt);
    }
  }, [isReady, sensorData.latitude, sensorData.longitude, duration]);

  // Berechne Ausrichtungsfehler
  useEffect(() => {
    const errors = calculateAlignmentError(
      sensorData.heading,
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
  }, [sensorData.heading, sensorData.pitch, targetAzimuth, targetElevation]);

  return (
    <div className="h-dvh overflow-hidden bg-gradient-to-b from-sky-100 via-indigo-50 to-amber-100 px-3 py-2 text-slate-900">
      <div className="mx-auto h-full w-full max-w-[560px] grid grid-rows-[auto_1fr_auto] gap-2">
        <section className="rounded-2xl bg-white/85 border border-sky-200 shadow-sm px-1 py-2">
          <DurationSlider
            duration={duration}
            onChange={setDuration}
            min={0.5}
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

            <div className="min-w-0 h-full flex items-center justify-center">
              <Compass
                currentHeading={sensorData.heading}
                targetAzimuth={targetAzimuth}
                isAccurate={isAccurate && elevationError < 10}
              />
            </div>
          </div>
        </main>

        <div className="text-center text-xs text-slate-600 h-4">
          {error ? "Sensorfehler" : !isReady ? "..." : ""}
        </div>
      </div>
    </div>
  );
};
