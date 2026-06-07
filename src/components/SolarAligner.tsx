import React, { useState, useEffect } from "react";
import { Compass } from "./Compass";
import { InclinationBar } from "./InclinationBar";
import { DurationSlider } from "./DurationSlider";
import {
  sensorData,
  initializeSensors,
  requestOrientationPermission,
  getError,
  getIsReady,
  getPermissionRequired,
  getHeadingSource,
  subscribe,
} from "../hooks/useSensorData";
import {
  calculateSolarPosition,
  calculateAlignmentError,
  isAlignmentAccurate,
  getSolarDayTimes,
} from "../utils/solarCalculations";

const getStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

const addHours = (date: Date, hours: number) =>
  new Date(date.getTime() + hours * 60 * 60_000);

const DEFAULT_RANGE_HOURS = 4;

const clampDate = (value: Date, min: Date, max: Date) => {
  if (value < min) {
    return new Date(min);
  }
  if (value > max) {
    return new Date(max);
  }
  return new Date(value);
};

export const SolarAligner: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() =>
    getStartOfDay(new Date()),
  );
  const [targetAzimuth, setTargetAzimuth] = useState(180);
  const [targetElevation, setTargetElevation] = useState(45);
  const [sunriseTime, setSunriseTime] = useState<Date | null>(null);
  const [sunsetTime, setSunsetTime] = useState<Date | null>(null);
  const [rangeStartTime, setRangeStartTime] = useState<Date | null>(null);
  const [rangeEndTime, setRangeEndTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [hasUserAdjustedRange, setHasUserAdjustedRange] = useState(false);
  const [elevationError, setElevationError] = useState(0);
  const [isAccurate, setIsAccurate] = useState(false);
  const [headingOffset, setHeadingOffset] = useState<number | null>(null);
  // Rerender-Trigger für Sensor-Updates
  const [, setTick] = useState(0);

  const normalizeHeading = (angle: number) => ((angle % 360) + 360) % 360;
  const calibrationBaseHeading = sensorData.magneticHeading;
  const canCalibrate = calibrationBaseHeading !== null;
  const effectiveHeading = normalizeHeading(
    headingOffset === null || calibrationBaseHeading === null
      ? sensorData.heading
      : calibrationBaseHeading - headingOffset,
  );

  // Initialize sensors on mount and subscribe to updates
  useEffect(() => {
    initializeSensors();
    const unsubscribe = subscribe(() => setTick((t) => t + 1));
    return () => {
      unsubscribe();
    };
  }, []);

  const handleCalibrate = () => {
    if (!canCalibrate || calibrationBaseHeading === null) {
      return;
    }

    setHeadingOffset(calibrationBaseHeading);
  };

  const handleResetCalibration = () => {
    setHeadingOffset(null);
  };

  const canGoPreviousDay = !isSameDay(selectedDate, getStartOfDay(new Date()));

  const handlePreviousDay = () => {
    if (!canGoPreviousDay) {
      return;
    }

    setSelectedDate((current) => getStartOfDay(addDays(current, -1)));
    setHasUserAdjustedRange(false);
  };

  const handleNextDay = () => {
    setSelectedDate((current) => getStartOfDay(addDays(current, 1)));
    setHasUserAdjustedRange(false);
  };

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 30_000);

    return () => window.clearInterval(timerId);
  }, []);

  // Berechne Tagesgrenzen und Default-Zeitfenster wenn GPS-Daten vorhanden sind
  useEffect(() => {
    const isReady = getIsReady();
    if (
      isReady &&
      sensorData.latitude !== null &&
      sensorData.longitude !== null
    ) {
      const dayTimes = getSolarDayTimes(
        sensorData.latitude,
        sensorData.longitude,
        selectedDate,
      );

      setSunriseTime(dayTimes.sunriseTime);
      setSunsetTime(dayTimes.sunsetTime);

      const today = getStartOfDay(new Date());
      const isToday = isSameDay(selectedDate, today);

      if (hasUserAdjustedRange) {
        return;
      }

      const latestAllowedStart = addMinutes(dayTimes.sunsetTime, -1);
      const defaultStart = clampDate(
        isToday ? currentTime : dayTimes.sunriseTime,
        dayTimes.sunriseTime,
        latestAllowedStart,
      );
      const defaultEnd = clampDate(
        addHours(defaultStart, DEFAULT_RANGE_HOURS),
        addMinutes(defaultStart, 1),
        dayTimes.sunsetTime,
      );

      setRangeStartTime(defaultStart);
      setRangeEndTime(defaultEnd);
    }
  }, [
    sensorData.latitude,
    sensorData.longitude,
    selectedDate,
    currentTime,
    hasUserAdjustedRange,
  ]);

  // Berechne Solar-Position fuer das gewählte Zeitintervall
  useEffect(() => {
    const isReady = getIsReady();
    if (
      isReady &&
      sensorData.latitude !== null &&
      sensorData.longitude !== null &&
      rangeStartTime !== null &&
      rangeEndTime !== null
    ) {
      const solarPos = calculateSolarPosition({
        latitude: sensorData.latitude,
        longitude: sensorData.longitude,
        startTime: rangeStartTime,
        endTime: rangeEndTime,
      });

      // Ziel fuer die obere Modulkante: entgegengesetzt zur Sonnenrichtung.
      setTargetAzimuth(normalizeHeading(solarPos.azimuth + 180));
      setTargetElevation(solarPos.tilt);
    }
  }, [sensorData.latitude, sensorData.longitude, rangeStartTime, rangeEndTime]);

  const handleChangeStartTime = (value: Date) => {
    setHasUserAdjustedRange(true);

    if (rangeEndTime === null) {
      setRangeStartTime(value);
      return;
    }

    const nextStart =
      value < rangeEndTime ? value : addMinutes(rangeEndTime, -1);
    setRangeStartTime(nextStart);
  };

  const handleChangeEndTime = (value: Date) => {
    setHasUserAdjustedRange(true);

    if (rangeStartTime === null) {
      setRangeEndTime(value);
      return;
    }

    const nextEnd =
      value > rangeStartTime ? value : addMinutes(rangeStartTime, 1);
    setRangeEndTime(nextEnd);
  };

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
            selectedDate={selectedDate}
            canGoPreviousDay={canGoPreviousDay}
            onPreviousDay={handlePreviousDay}
            onNextDay={handleNextDay}
            sunriseTime={sunriseTime}
            sunsetTime={sunsetTime}
            startTime={rangeStartTime}
            endTime={rangeEndTime}
            onChangeStartTime={handleChangeStartTime}
            onChangeEndTime={handleChangeEndTime}
          />
        </section>

        <main className="rounded-2xl bg-white/90 border border-indigo-200 shadow-md p-2 min-h-0 overflow-hidden">
          <div
            className="h-full grid items-center gap-2"
            style={{ gridTemplateColumns: "124px minmax(0, 1fr)" }}
          >
            <div className="h-full min-h-0 border-r border-slate-200 pr-2 flex items-stretch justify-center">
              <InclinationBar targetElevation={targetElevation} />
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
                {getPermissionRequired() && (
                  <button
                    type="button"
                    onClick={() => void requestOrientationPermission()}
                    className="rounded-lg border border-rose-400 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 active:scale-[0.99]"
                  >
                    Sensoren aktivieren
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>

        <div className="text-center text-xs text-slate-600 h-4">
          {getError()
            ? "Sensorfehler"
            : getPermissionRequired()
              ? "Tippe 'Sensoren aktivieren' oben, um Berechtigungen zu erlauben"
              : !getIsReady()
                ? "..."
                : !canCalibrate
                  ? "Kompass: Ohne Magnetdaten (nur IMU)"
                  : headingOffset === null
                    ? `Kompass: Sensor (${getHeadingSource()})`
                    : `Kompass: Kalibriert auf Magnet (${getHeadingSource()})`}
        </div>
      </div>
    </div>
  );
};
