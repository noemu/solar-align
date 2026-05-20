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

interface SolarParams {
  latitude: number;
  longitude: number;
  duration: number; // in Stunden
}

const MINUTES_PER_DAY = 1440;
const NOON_MINUTES = 720;

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

const getMinutesOfDay = (date: Date) =>
  date.getHours() * 60 + date.getMinutes();

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
  const { latitude, longitude, duration } = params;
  const durationMinutes = Math.max(1, Math.round(duration * 60));
  // Fester Schritt verhindert Spruenge bei Slider-Aenderungen durch wechselnde Diskretisierung.
  const sampleStep = 2;
  const sampleCount = Math.max(2, Math.ceil(durationMinutes / sampleStep) + 1);

  const samples = Array.from({ length: sampleCount }, (_, index) => {
    const sampleMinutes = Math.min(durationMinutes, index * sampleStep);
    const sampleDate = new Date(now.getTime() + sampleMinutes * 60000);
    return getSolarSnapshot(latitude, longitude, sampleDate);
  });

  const azimuth = getAverageAzimuth(samples.map((sample) => sample.azimuth));
  const elevation =
    samples.reduce((sum, sample) => sum + sample.elevation, 0) / samples.length;
  // Physik: Wenn die Sonne tiefer steht, muss das Panel steiler sein.
  const tilt = 90 - elevation;

  // Zeit bis zum Sonnenhöchststand (ungefähr)
  const nowMinutes = getMinutesOfDay(now);
  let timeUntilOptimal = Math.abs(nowMinutes - NOON_MINUTES);
  if (timeUntilOptimal > NOON_MINUTES) {
    timeUntilOptimal = MINUTES_PER_DAY - timeUntilOptimal;
  }

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
