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

const normalizeHeading = (angle: number) => ((angle % 360) + 360) % 360;

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
  let heading = event.alpha;

  if (screenAngle === 90) {
    heading -= 90;
  } else if (screenAngle === -90 || screenAngle === 270) {
    heading += 90;
  } else if (screenAngle === 180 || screenAngle === -180) {
    heading += 180;
  }

  return { heading: normalizeHeading(heading), usedWebkit: false };
};

export const useSensorData = () => {
  const hasAbsoluteHeading = useRef(false);
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

  // Device Orientation (Kompass + Neigung)
  useEffect(() => {
    if (typeof DeviceOrientationEvent === "undefined") {
      setError({
        type: "not-supported",
        message: "Device Orientation nicht unterstützt",
      });
      return;
    }

    const handleOrientation = (
      rawEvent: DeviceOrientationEvent,
      isAbsolute: boolean,
    ) => {
      const event = rawEvent as OrientationEventWithCompass;
      const result = getHeadingFromEvent(event);

      if (result === null) {
        return;
      }

      if (isAbsolute) {
        hasAbsoluteHeading.current = true;
      }

      // Sobald absolute Werte vorhanden sind, relative Werte ignorieren.
      if (!isAbsolute && hasAbsoluteHeading.current) {
        return;
      }

      const source: HeadingSource = isAbsolute
        ? result.usedWebkit
          ? "abs+webkit"
          : "abs+alpha"
        : result.usedWebkit
          ? "rel+webkit"
          : "rel+alpha";
      const hasMagneticReference = isAbsolute || result.usedWebkit;

      setHeadingSource(source);
      setSensorData((prev) => ({
        ...prev,
        heading: result.heading,
        magneticHeading: hasMagneticReference
          ? result.heading
          : prev.magneticHeading,
        pitch: typeof event.beta === "number" ? event.beta : prev.pitch,
        roll: typeof event.gamma === "number" ? event.gamma : prev.roll,
        rawAlpha: typeof event.alpha === "number" ? event.alpha : prev.rawAlpha,
      }));
    };

    const onAbsoluteOrientation = (event: DeviceOrientationEvent) => {
      handleOrientation(event, true);
    };

    const onOrientation = (event: DeviceOrientationEvent) => {
      handleOrientation(event, false);
    };

    const attachOrientationListeners = () => {
      window.addEventListener(
        "deviceorientationabsolute",
        onAbsoluteOrientation,
      );
      window.addEventListener("deviceorientation", onOrientation);
    };

    // Check permission (iOS 13+)
    if (
      typeof (DeviceOrientationEvent as any)?.requestPermission === "function"
    ) {
      (DeviceOrientationEvent as any)
        .requestPermission()
        .then((permission: string) => {
          if (permission === "granted") {
            attachOrientationListeners();
          } else {
            setError({
              type: "permission",
              message: "Geräte-Orientierungsberechtigung verweigert",
            });
          }
        })
        .catch(() => {
          setError({
            type: "permission",
            message: "Konnte Berechtigung nicht anfordern",
          });
        });
    } else {
      // Android oder andere Browser
      attachOrientationListeners();
    }

    return () => {
      window.removeEventListener(
        "deviceorientationabsolute",
        onAbsoluteOrientation,
      );
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, []);

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

  return { sensorData, headingSource, error, isReady };
};
