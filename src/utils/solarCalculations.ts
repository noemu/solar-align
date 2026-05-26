import * as SunCalc from "suncalc";

/**
 * Berechnet die optimale Ausrichtung des PV-Moduls basierend auf:
 * - Breitengrad
 * - Tageszeit
 * - Jahreszeit
 */

interface SolarPosition {
  azimuth: number; // 0-360 Grad (Kompass-Richtung)
  tilt: number; // 0-90 Grad (Panel-Neigung, 0 = flach, 90 = steil)
  timeUntilOptimal: number; // Minuten
}

export interface SolarDayTimes {
  sunriseTime: Date;
  sunsetTime: Date;
}

interface SolarParams {
  latitude: number;
  longitude: number;
  startTime: Date;
  endTime: Date;
}

const normalizeHeading = (angle: number) => ((angle % 360) + 360) % 360;

const getSolarSnapshot = (latitude: number, longitude: number, date: Date) => {
  const pos = SunCalc.getPosition(date, latitude, longitude);
  // SunCalc: azimuth in Bogenmaß, 0 = Süden, negativ = Osten, positiv = Westen
  // Wir wollen: 0 = Norden, 90 = Osten, 180 = Süden, 270 = Westen
  // Umrechnung: azimuthDeg = (pos.azimuth * 180 / Math.PI + 180 + 360) % 360
  const azimuth = normalizeHeading((pos.azimuth * 180) / Math.PI + 180);
  const elevation = Math.max(0, (pos.altitude * 180) / Math.PI); // 0 = Horizont, 90 = Zenit
  return { azimuth, elevation };
};

const isValidDate = (value: Date | undefined): value is Date => {
  return value instanceof Date && !Number.isNaN(value.getTime());
};

const setClock = (date: Date, hours: number, minutes: number) => {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

const getStartOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getEndOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

export const getSolarDayTimes = (
  latitude: number,
  longitude: number,
  date: Date,
): SolarDayTimes => {
  // Lokaler Mittagsanker vermeidet UTC/Zeitzonen-Verschiebungen um Mitternacht.
  const anchorDate = new Date(date);
  anchorDate.setHours(12, 0, 0, 0);
  const times = SunCalc.getTimes(anchorDate, latitude, longitude);
  const dayStart = getStartOfDay(date);
  const dayEnd = getEndOfDay(date);

  const fallbackSunrise = setClock(date, 6, 0);
  const fallbackSunset = setClock(date, 18, 0);
  const sunriseCandidate =
    isValidDate(times.sunrise) &&
    times.sunrise.getTime() >= dayStart.getTime() &&
    times.sunrise.getTime() <= dayEnd.getTime()
      ? times.sunrise
      : fallbackSunrise;
  const sunsetCandidate =
    isValidDate(times.sunset) &&
    times.sunset.getTime() >= dayStart.getTime() &&
    times.sunset.getTime() <= dayEnd.getTime()
      ? times.sunset
      : fallbackSunset;

  const sunriseTime = sunriseCandidate;
  const fallbackAfterSunrise = new Date(
    sunriseTime.getTime() + 12 * 60 * 60 * 1000,
  );
  const fallbackSameDayMax = setClock(sunriseTime, 23, 59);
  const fallbackValidSunset =
    fallbackAfterSunrise > fallbackSameDayMax
      ? fallbackSameDayMax
      : fallbackAfterSunrise;
  const sunsetTime =
    sunsetCandidate.getTime() > sunriseTime.getTime()
      ? sunsetCandidate
      : fallbackValidSunset;

  return {
    sunriseTime,
    sunsetTime,
  };
};

const getAverageAzimuth = (angles: number[]) => {
  const vector = angles.reduce(
    (sum, angle) => {
      const radians = (angle * Math.PI) / 180;
      return {
        x: sum.x + Math.cos(radians),
        y: sum.y + Math.sin(radians),
      };
    },
    { x: 0, y: 0 },
  );

  return normalizeHeading((Math.atan2(vector.y, vector.x) * 180) / Math.PI);
};

/**
 * Exakte Sonnenstandsberechnung via SunCalc mit Mittelwertbildung im Zeitfenster.
 */
export const calculateSolarPosition = (
  params: SolarParams,
  now: Date = new Date(),
): SolarPosition => {
  const { latitude, longitude, startTime, endTime } = params;
  const durationMinutes = Math.max(
    1,
    Math.round((endTime.getTime() - startTime.getTime()) / 60000),
  );
  // Fester Schritt verhindert Spruenge bei Slider-Aenderungen durch wechselnde Diskretisierung.
  const sampleStep = 2;
  const sampleCount = Math.max(2, Math.ceil(durationMinutes / sampleStep) + 1);

  const samples = Array.from({ length: sampleCount }, (_, index) => {
    const sampleMinutes = Math.min(durationMinutes, index * sampleStep);
    const sampleDate = new Date(startTime.getTime() + sampleMinutes * 60000);
    return getSolarSnapshot(latitude, longitude, sampleDate);
  });

  const azimuth = getAverageAzimuth(samples.map((sample) => sample.azimuth));
  const elevation =
    samples.reduce((sum, sample) => sum + sample.elevation, 0) / samples.length;
  // Physik: Wenn die Sonne tiefer steht, muss das Panel steiler sein.
  const tilt = 90 - elevation;

  const midpoint = new Date((startTime.getTime() + endTime.getTime()) / 2);
  const timeUntilOptimal = Math.max(
    0,
    Math.round(Math.abs(midpoint.getTime() - now.getTime()) / 60000),
  );

  return {
    azimuth,
    tilt,
    timeUntilOptimal,
  };
};

/**
 * Berechnet den Fehlerwinkel zwischen aktueller und Zielausrichtung
 */
export const calculateAlignmentError = (
  currentHeading: number,
  currentPitch: number,
  targetAzimuth: number,
  targetTilt: number,
): { headingError: number; elevationError: number } => {
  const current = normalizeHeading(currentHeading);
  const target = normalizeHeading(targetAzimuth);

  // Berechne kürzesten Weg zwischen den Winkeln
  let headingError = target - current;
  if (headingError > 180) headingError -= 360;
  if (headingError < -180) headingError += 360;

  // Elevation Error auf Basis des absoluten Neigungswinkels (0..90°)
  const elevationError = targetTilt - Math.abs(currentPitch);

  return {
    headingError: Math.round(headingError),
    elevationError: Math.round(elevationError),
  };
};

/**
 * Bestimmt, ob die Ausrichtung gut genug ist
 */
export const isAlignmentAccurate = (
  headingError: number,
  elevationError: number,
  tolerance: number = 5,
): boolean => {
  return (
    Math.abs(headingError) <= tolerance && Math.abs(elevationError) <= tolerance
  );
};
