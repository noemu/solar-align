export type HeadingSource =
  | "none"
  | "abs+webkit"
  | "abs+alpha"
  | "rel+webkit"
  | "rel+alpha";

export interface SensorData {
  heading: number; // 0-360 Grad Kompass
  magneticHeading: number | null; // Magnet/Fusion-basierte Ausrichtung
  pitch: number; // -90 bis 90 (Neigung nach vorn/hinten)
  roll: number; // -180 bis 180 (Neigung links/rechts)
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  rawAlpha: number | null; // unbearbeiteter alpha-Wert
}

export interface SensorError {
  type: "permission" | "not-supported" | "location" | "orientation";
  message: string;
}

type OrientationEventWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

interface OrientationSample {
  isAbsolute: boolean;
  heading: number | null;
  usedWebkit: boolean;
  inclination: number | null;
  roll: number | null;
  rawAlpha: number | null;
}

const ORIENTATION_UI_FPS = 30;
const ORIENTATION_FRAME_INTERVAL_MS = 1000 / ORIENTATION_UI_FPS;

const normalizeHeading = (angle: number) => ((angle % 360) + 360) % 360;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getScreenOrientationAngle = () => {
  if (typeof window === "undefined") {
    return 0;
  }

  if (typeof window.screen?.orientation?.angle === "number") {
    return window.screen.orientation.angle;
  }

  const fallback = (window as Window & { orientation?: number }).orientation;
  return typeof fallback === "number" ? fallback : 0;
};

const getHeadingFromEvent = (
  event: OrientationEventWithCompass,
): { heading: number; usedWebkit: boolean } | null => {
  if (
    typeof event.webkitCompassHeading === "number" &&
    Number.isFinite(event.webkitCompassHeading)
  ) {
    return {
      heading: normalizeHeading(event.webkitCompassHeading),
      usedWebkit: true,
    };
  }

  if (typeof event.alpha !== "number" || !Number.isFinite(event.alpha)) {
    return null;
  }

  const screenAngle = getScreenOrientationAngle();
  let heading = 360 - event.alpha;

  if (screenAngle === 90) {
    heading -= 90;
  } else if (screenAngle === -90 || screenAngle === 270) {
    heading += 90;
  } else if (screenAngle === 180 || screenAngle === -180) {
    heading += 180;
  }

  return { heading: normalizeHeading(heading), usedWebkit: false };
};

const getInclinationFromEvent = (
  event: DeviceOrientationEvent,
): number | null => {
  if (
    typeof event.beta !== "number" ||
    !Number.isFinite(event.beta) ||
    typeof event.gamma !== "number" ||
    !Number.isFinite(event.gamma)
  ) {
    return null;
  }

  const betaRad = (event.beta * Math.PI) / 180;
  const gammaRad = (event.gamma * Math.PI) / 180;
  const cosTilt = Math.cos(betaRad) * Math.cos(gammaRad);
  const tilt = (Math.acos(clamp(cosTilt, -1, 1)) * 180) / Math.PI;

  return clamp(Math.min(tilt, 180 - tilt), 0, 90);
};

// ============ Global State (kein React) ============
export const sensorData: SensorData = {
  heading: 0,
  magneticHeading: null,
  pitch: 0,
  roll: 0,
  latitude: null,
  longitude: null,
  accuracy: null,
  rawAlpha: null,
};

let headingSource: HeadingSource = "none";
let error: SensorError | null = null;
let isReady = false;
let permissionRequired = false;

let hasAbsoluteHeading = false;
let lastOrientationFrameAt = 0;

// Subscription-System für UI-Updates
const subscribers = new Set<() => void>();

export const subscribe = (fn: () => void) => {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
};

const notifySubscribers = () => {
  subscribers.forEach((fn) => fn());
};

// ============ Sensor-Datenverarbeitung ============
const applyOrientationSample = (sample: OrientationSample) => {
  const hasHeading = sample.heading !== null;

  if (sample.isAbsolute && hasHeading) {
    hasAbsoluteHeading = true;
  }

  if (!sample.isAbsolute && hasAbsoluteHeading) {
    return;
  }

  if (hasHeading) {
    headingSource = sample.isAbsolute
      ? sample.usedWebkit
        ? "abs+webkit"
        : "abs+alpha"
      : sample.usedWebkit
        ? "rel+webkit"
        : "rel+alpha";
  }

  sensorData.heading = hasHeading
    ? (sample.heading as number)
    : sensorData.heading;

  sensorData.magneticHeading =
    hasHeading && (sample.isAbsolute || sample.usedWebkit)
      ? (sample.heading as number)
      : sensorData.magneticHeading;

  sensorData.pitch = sample.inclination ?? sensorData.pitch;
  sensorData.roll = sample.roll ?? sensorData.roll;
  sensorData.rawAlpha = sample.rawAlpha ?? sensorData.rawAlpha;

  notifySubscribers();
};

const captureOrientationSample = (
  rawEvent: DeviceOrientationEvent,
  isAbsolute: boolean,
) => {
  const now = performance.now();
  if (now - lastOrientationFrameAt < ORIENTATION_FRAME_INTERVAL_MS) {
    return;
  }
  lastOrientationFrameAt = now;

  const event = rawEvent as OrientationEventWithCompass;
  const result = getHeadingFromEvent(event);

  const sample: OrientationSample = {
    isAbsolute,
    heading: result?.heading ?? null,
    usedWebkit: result?.usedWebkit ?? false,
    inclination: getInclinationFromEvent(event),
    roll:
      typeof event.gamma === "number" && Number.isFinite(event.gamma)
        ? event.gamma
        : null,
    rawAlpha:
      typeof event.alpha === "number" && Number.isFinite(event.alpha)
        ? event.alpha
        : null,
  };
  applyOrientationSample(sample);
};

const onAbsoluteOrientation = (event: DeviceOrientationEvent) => {
  captureOrientationSample(event, true);
};

const onOrientation = (event: DeviceOrientationEvent) => {
  captureOrientationSample(event, false);
};

const attachOrientationListeners = () => {
  window.addEventListener("deviceorientationabsolute", onAbsoluteOrientation);
  window.addEventListener("deviceorientation", onOrientation);
};

const detachOrientationListeners = () => {
  window.removeEventListener(
    "deviceorientationabsolute",
    onAbsoluteOrientation,
  );
  window.removeEventListener("deviceorientation", onOrientation);
};

const attachVisibilityListener = () => {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // App is in background - stop sensors
      detachOrientationListeners();
    } else {
      // App is visible again - restart sensors
      attachOrientationListeners();
    }
  });
};

// ============ Initialisierung ============
let initializationDone = false;

export const initializeSensors = async () => {
  if (initializationDone) return;
  initializationDone = true;

  // Visibility listener for background/foreground handling
  attachVisibilityListener();

  // DeviceOrientation
  if (typeof DeviceOrientationEvent === "undefined") {
    error = {
      type: "not-supported",
      message: "Device Orientation nicht unterstützt",
    };
    return;
  }

  if (
    typeof (DeviceOrientationEvent as any)?.requestPermission === "function"
  ) {
    permissionRequired = true;
  } else {
    attachOrientationListeners();
  }

  // Geolocation
  if (!navigator.geolocation) {
    error = {
      type: "not-supported",
      message: "Geolocation nicht unterstützt",
    };
    return;
  }

  navigator.geolocation.watchPosition(
    (position) => {
      sensorData.latitude = position.coords.latitude;
      sensorData.longitude = position.coords.longitude;
      sensorData.accuracy = position.coords.accuracy;
      isReady = true;
      notifySubscribers();
    },
    (err) => {
      console.error("Geolocation error:", err);
      error = {
        type: "location",
        message: `GPS-Fehler: ${err.message}`,
      };
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 5000,
    },
  );
};

export const requestOrientationPermission = async () => {
  if (
    typeof (DeviceOrientationEvent as any)?.requestPermission !== "function"
  ) {
    attachOrientationListeners();
    permissionRequired = false;
    return true;
  }

  try {
    const permission = await (
      DeviceOrientationEvent as any
    ).requestPermission();
    if (permission === "granted") {
      attachOrientationListeners();
      permissionRequired = false;
      return true;
    }
    error = {
      type: "permission",
      message: "Geräte-Orientierungsberechtigung verweigert",
    };
    return false;
  } catch (e) {
    error = {
      type: "permission",
      message: "Konnte Berechtigung nicht anfordern",
    };
    return false;
  }
};

// ============ Getter für Zustand ============
export const getHeadingSource = () => headingSource;
export const getError = () => error;
export const getIsReady = () => isReady;
export const getPermissionRequired = () => permissionRequired;
