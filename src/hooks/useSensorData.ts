import { useEffect, useRef, useState } from "react";

export type HeadingSource =
  | "none"
  | "abs+webkit"
  | "abs+alpha"
  | "rel+webkit"
  | "rel+alpha";

interface SensorData {
  heading: number; // 0-360 Grad Kompass
  magneticHeading: number | null; // Magnet/Fusion-basierte Ausrichtung
  pitch: number; // -90 bis 90 (Neigung nach vorn/hinten)
  roll: number; // -180 bis 180 (Neigung links/rechts)
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  rawAlpha: number | null; // unbearbeiteter alpha-Wert
}

interface SensorError {
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
  // alpha laeuft in die entgegengesetzte Richtung zu einem klassischen Kompass.
  // Deshalb wird fuer den Fallback 360 - alpha verwendet.
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

  // Spiegelung fuer face-up/face-down, damit der Wert stabil in 0..90 bleibt.
  return clamp(Math.min(tilt, 180 - tilt), 0, 90);
};

export const useSensorData = () => {
  const hasAbsoluteHeading = useRef(false);
  const lastOrientationFrameAt = useRef<number>(0);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData>({
    heading: 0,
    magneticHeading: null,
    pitch: 0,
    roll: 0,
    latitude: null,
    longitude: null,
    accuracy: null,
    rawAlpha: null,
  });
  const [headingSource, setHeadingSource] = useState<HeadingSource>("none");
  const [error, setError] = useState<SensorError | null>(null);
  const [isReady, setIsReady] = useState(false);

  const applyOrientationSample = (sample: OrientationSample) => {
    const hasHeading = sample.heading !== null;

    if (sample.isAbsolute && hasHeading) {
      hasAbsoluteHeading.current = true;
    }

    // Sobald absolute Werte vorhanden sind, relative Werte ignorieren.
    if (!sample.isAbsolute && hasAbsoluteHeading.current) {
      return;
    }

    if (hasHeading) {
      const source: HeadingSource = sample.isAbsolute
        ? sample.usedWebkit
          ? "abs+webkit"
          : "abs+alpha"
        : sample.usedWebkit
          ? "rel+webkit"
          : "rel+alpha";
      setHeadingSource(source);
    }

    setSensorData((prev) => ({
      ...prev,
      heading: hasHeading ? (sample.heading as number) : prev.heading,
      magneticHeading:
        hasHeading && (sample.isAbsolute || sample.usedWebkit)
          ? (sample.heading as number)
          : prev.magneticHeading,
      pitch: sample.inclination ?? prev.pitch,
      roll: sample.roll ?? prev.roll,
      rawAlpha: sample.rawAlpha ?? prev.rawAlpha,
    }));
  };

  const captureOrientationSample = (
    rawEvent: DeviceOrientationEvent,
    isAbsolute: boolean,
  ) => {
    const now = performance.now();
    if (now - lastOrientationFrameAt.current < ORIENTATION_FRAME_INTERVAL_MS) {
      return;
    }
    lastOrientationFrameAt.current = now;

    const event = rawEvent as OrientationEventWithCompass;
    const result = getHeadingFromEvent(event);

    const sample = {
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

  useEffect(() => {
    if (typeof DeviceOrientationEvent === "undefined") {
      setError({
        type: "not-supported",
        message: "Device Orientation nicht unterstützt",
      });
      return;
    }

    // Check permission (iOS 13+). On iOS this must be called from a user
    // gesture; therefore we only mark that permission is required and
    // expose `requestOrientationPermission` to the UI.
    if (
      typeof (DeviceOrientationEvent as any)?.requestPermission === "function"
    ) {
      setPermissionRequired(true);
    } else {
      attachOrientationListeners();
    }

    return () => {
      detachOrientationListeners();
    };
  }, []);

  const requestOrientationPermission = async () => {
    if (
      typeof (DeviceOrientationEvent as any)?.requestPermission !== "function"
    ) {
      // Not required / not supported
      attachOrientationListeners();
      setPermissionRequired(false);
      return true;
    }

    try {
      const permission = await (
        DeviceOrientationEvent as any
      ).requestPermission();
      if (permission === "granted") {
        attachOrientationListeners();
        setPermissionRequired(false);
        return true;
      }
      setError({
        type: "permission",
        message: "Geräte-Orientierungsberechtigung verweigert",
      });
      return false;
    } catch (e) {
      setError({
        type: "permission",
        message: "Konnte Berechtigung nicht anfordern",
      });
      return false;
    }
  };

  // Geolocation (GPS)
  useEffect(() => {
    if (!navigator.geolocation) {
      setError({
        type: "not-supported",
        message: "Geolocation nicht unterstützt",
      });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setSensorData((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }));
        setIsReady(true);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setError({
          type: "location",
          message: `GPS-Fehler: ${err.message}`,
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return {
    sensorData,
    headingSource,
    error,
    isReady,
    requestOrientationPermission,
    permissionRequired,
  } as const;
};
