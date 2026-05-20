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
  const [headingError, setHeadingError] = useState(0);
  const [elevationError, setElevationError] = useState(0);
  const [isAccurate, setIsAccurate] = useState(false);
  const midpointHours = duration / 2;

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
      setTargetElevation(solarPos.elevation);
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

    setHeadingError(errors.headingError);
    setElevationError(errors.elevationError);

    const accurate = isAlignmentAccurate(
      errors.headingError,
      errors.elevationError,
      5,
    );
    setIsAccurate(accurate);
  }, [sensorData.heading, sensorData.pitch, targetAzimuth, targetElevation]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-100 to-amber-100">
      {/* Header (sticky) */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-blue-200 shadow-sm px-4 py-3 flex flex-col items-center">
        <h1 className="text-2xl font-bold text-blue-900 tracking-tight flex items-center gap-2">
          <span className="text-3xl">☀️</span> Solar Align
        </h1>
        <p className="text-blue-700 text-sm mt-1 text-center">
          Richte dein PV-Modul optimal zur Sonne aus
        </p>
        <p className="text-blue-500 text-xs mt-1 text-center">
          Zielwert: Mittelwert der Sonnenposition von jetzt bis in{" "}
          <b>{duration}h</b>
        </p>
      </header>

      {/* Fehler anzeigen */}
      {error && (
        <div
          className={`rounded-xl p-4 mt-4 mx-2 border-2 text-center text-base font-semibold shadow-md ${
            error.type === "permission"
              ? "bg-red-100 border-red-400 text-red-800"
              : "bg-yellow-100 border-yellow-400 text-yellow-800"
          }`}
        >
          <div className="text-2xl mb-1">⚠️</div>
          {error.message}
          <div className="text-xs mt-2 font-normal">
            {error.type === "permission" &&
              "Bitte erlaube dem Browser den Zugriff auf Sensoren und GPS."}
            {error.type === "location" &&
              "GPS wird noch aktiviert... Stelle sicher, dass der Standort aktiviert ist."}
            {error.type === "not-supported" &&
              "Dein Gerät unterstützt diese Funktionalität möglicherweise nicht."}
          </div>
        </div>
      )}

      {/* Status */}
      {!isReady && (
        <div className="bg-blue-50 border-2 border-blue-300 text-blue-900 rounded-xl p-4 mt-4 mx-2 text-center shadow-sm">
          <div className="text-2xl mb-1">⏳</div>
          <div className="font-semibold">Initialisierung...</div>
          <div className="text-sm mt-1">
            GPS und Sensoren werden aktiviert. Dies kann einige Sekunden dauern.
          </div>
        </div>
      )}

      {/* Hauptinhalt */}
      <main className="flex-1 flex flex-col items-center w-full max-w-md mx-auto px-2 py-2 gap-4">
        {/* Duration Slider */}
        <section className="w-full">
          <DurationSlider
            duration={duration}
            onChange={setDuration}
            min={0.5}
            max={12}
          />
        </section>

        {/* Kompass und Balken */}
        <section className="w-full flex flex-col sm:flex-row gap-4 items-stretch justify-center">
          {/* Kompass und Neigungswinkel nebeneinander */}
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <Compass
              currentHeading={sensorData.heading}
              targetAzimuth={targetAzimuth}
              isAccurate={isAccurate && elevationError < 10}
            />
            <div className="flex flex-row gap-4 mt-2 w-full justify-center">
              <div className="flex flex-col items-center bg-blue-50 rounded-xl px-3 py-2 shadow text-blue-800">
                <span className="text-xs font-semibold">Neigung aktuell</span>
                <span className="text-2xl font-bold">
                  {Math.round(sensorData.pitch)}°
                </span>
              </div>
              <div className="flex flex-col items-center bg-amber-50 rounded-xl px-3 py-2 shadow text-amber-800">
                <span className="text-xs font-semibold">Neigung Ziel</span>
                <span className="text-2xl font-bold">
                  {Math.round(targetElevation)}°
                </span>
              </div>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <InclinationBar
              currentPitch={sensorData.pitch}
              targetElevation={targetElevation}
              headingError={headingError}
              elevationError={elevationError}
            />
          </div>
        </section>

        {/* Sensor-Daten Card */}
        <section className="w-full">
          <div className="bg-white/90 rounded-2xl shadow-lg p-4 border border-gray-200">
            <h3 className="text-lg font-bold text-blue-900 mb-3 text-center">
              📊 Sensor-Daten
            </h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-blue-50 p-2">
                <div className="text-xs text-blue-700 font-semibold">
                  KOMPASS
                </div>
                <div className="text-xl font-bold text-blue-600">
                  {sensorData.heading}°
                </div>
                <div className="text-xs text-blue-500 mt-1">
                  Aktuelle Ausrichtung
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 p-2">
                <div className="text-xs text-amber-700 font-semibold">ZIEL</div>
                <div className="text-xl font-bold text-amber-600">
                  {targetAzimuth}°
                </div>
                <div className="text-xs text-amber-500 mt-1">
                  Sonne-Richtung
                </div>
              </div>
              <div className="rounded-lg bg-green-50 p-2 col-span-2">
                <div className="text-xs text-green-700 font-semibold">
                  FEHLER
                </div>
                <div
                  className={`text-xl font-bold ${isAccurate ? "text-green-600" : "text-red-600"}`}
                >
                  {Math.abs(headingError)}°
                </div>
                <div className="text-xs text-green-500 mt-1">Abweichung</div>
              </div>
              <div className="rounded-lg bg-blue-50 p-2">
                <div className="text-xs text-blue-700 font-semibold">
                  NEIGUNG AKTUELL
                </div>
                <div className="text-xl font-bold text-blue-600">
                  {Math.round(sensorData.pitch)}°
                </div>
                <div className="text-xs text-blue-500 mt-1">Höhenwinkel</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-2">
                <div className="text-xs text-amber-700 font-semibold">
                  NEIGUNG ZIEL
                </div>
                <div className="text-xl font-bold text-amber-600">
                  {Math.round(targetElevation)}°
                </div>
                <div className="text-xs text-amber-500 mt-1">Sonne-Höhe</div>
              </div>
              <div className="rounded-lg bg-gray-50 p-2 col-span-2">
                <div className="text-xs text-gray-700 font-semibold">
                  POSITION
                </div>
                <div className="text-xs font-mono text-gray-700 mt-1">
                  {sensorData.latitude?.toFixed(4)}°<br />
                  {sensorData.longitude?.toFixed(4)}°
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Erfolgsmitteilung */}
        {isAccurate && (
          <section className="w-full">
            <div className="bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-500 rounded-2xl p-6 text-center shadow-lg">
              <div className="text-3xl mb-2">🎉</div>
              <div className="text-xl font-bold text-green-800">
                Perfekte Ausrichtung erreicht!
              </div>
              <div className="text-sm text-green-700 mt-2">
                Dein PV-Modul ist optimal auf die Sonne ausgerichtet. Die
                nächsten {duration} Stunden sollten optimal sein.
              </div>
              <div className="text-xs text-green-700 mt-1">
                Referenzzeitpunkt des Fensters: in {midpointHours.toFixed(1)}h
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer (sticky) */}
      <footer className="sticky bottom-0 z-10 bg-white/80 backdrop-blur border-t border-blue-200 shadow-inner px-4 py-2 text-xs text-blue-700 text-center">
        <div>💡 Tipp: Lege dein Handy auf das PV-Modul und richte es aus.</div>
        <div className="mt-1">Die Sensoren kalibrieren sich automatisch.</div>
      </footer>
    </div>
  );
};
