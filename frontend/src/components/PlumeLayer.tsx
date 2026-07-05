/**
 * Wind-driven plume drift visualization.
 * Draws a directional arrow + risk cone from each active hotspot.
 */
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { Hotspot } from "../types";

interface Props {
  hotspots: Hotspot[];
}

const EARTH_RADIUS_KM = 6371.0;

function destinationPoint(lat: number, lon: number, bearingDeg: number, distKm: number) {
  const R = EARTH_RADIUS_KM;
  const d = distKm / R;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [(lat2 * 180) / Math.PI, ((lon2 * 180) / Math.PI + 540) % 360 - 180] as [number, number];
}

export default function PlumeLayer({ hotspots }: Props) {
  const map = useMap();
  const layersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    // Remove previous layers
    layersRef.current.forEach(l => { try { map.removeLayer(l); } catch (_) {} });
    layersRef.current = [];

    const active = hotspots.filter(
      h =>
        (h.status === "active" || h.status === "acknowledged") &&
        h.wind_speed != null &&
        h.wind_deg != null &&
        h.severity_score >= 2.5
    );

    for (const hotspot of active) {
      const windSpeed = hotspot.wind_speed ?? 3;
      const windDeg = hotspot.wind_deg ?? 225;

      // Wind direction: meteorological convention = direction wind comes FROM
      // Plume travels TO = windDeg + 180
      const plumeDeg = (windDeg + 180) % 360;

      // Distance the plume drifts in ~4 hours (km)
      const plumeDist = Math.min(3.0, windSpeed * 4 * 3600 / 1000);
      const minDist = 0.4;

      const origin: [number, number] = [hotspot.center_lat, hotspot.center_lon];
      const tipPoint = destinationPoint(hotspot.center_lat, hotspot.center_lon, plumeDeg, Math.max(minDist, plumeDist));

      // Severity-based opacity
      const opacity = 0.25 + (hotspot.severity_score / 5) * 0.35;
      const color = hotspot.severity_score >= 4 ? "#ef4444"
                  : hotspot.severity_score >= 3 ? "#f97316"
                  : "#eab308";

      // Main shaft arrow
      const shaft = L.polyline([origin, tipPoint], {
        color,
        weight: 2,
        opacity,
        dashArray: "6 4",
      }).addTo(map);
      layersRef.current.push(shaft);

      // Arrowhead at tip (two short lines forming a V)
      const leftWing  = destinationPoint(tipPoint[0], tipPoint[1], (plumeDeg + 150) % 360, 0.15);
      const rightWing = destinationPoint(tipPoint[0], tipPoint[1], (plumeDeg - 150 + 360) % 360, 0.15);

      const arrowhead = L.polyline([[leftWing, tipPoint, rightWing]], {
        color,
        weight: 2,
        opacity: opacity + 0.15,
      }).addTo(map);
      layersRef.current.push(arrowhead);

      // Cone: spread ±25° around plume direction
      const spread = 25;
      const leftEdge  = destinationPoint(hotspot.center_lat, hotspot.center_lon, (plumeDeg - spread + 360) % 360, Math.max(minDist, plumeDist) * 0.85);
      const rightEdge = destinationPoint(hotspot.center_lat, hotspot.center_lon, (plumeDeg + spread) % 360, Math.max(minDist, plumeDist) * 0.85);

      const cone = L.polygon([origin, leftEdge, tipPoint, rightEdge], {
        color,
        fillColor: color,
        fillOpacity: opacity * 0.35,
        weight: 0,
      }).addTo(map);
      layersRef.current.push(cone);

      // Label at tip: "4h plume"
      if (plumeDist > 0.3) {
        const label = L.marker(tipPoint, {
          icon: L.divIcon({
            className: "",
            html: `<div style="
              background: rgba(17,24,39,0.85);
              border: 1px solid ${color};
              color: ${color};
              font-size: 10px;
              font-weight: 700;
              padding: 2px 5px;
              border-radius: 4px;
              white-space: nowrap;
              pointer-events: none;
            ">4h drift →</div>`,
            iconAnchor: [30, 10],
          }),
        }).addTo(map);
        layersRef.current.push(label);
      }
    }

    return () => {
      layersRef.current.forEach(l => { try { map.removeLayer(l); } catch (_) {} });
      layersRef.current = [];
    };
  }, [map, hotspots]);

  return null;
}
