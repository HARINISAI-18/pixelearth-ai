"""Hotspot detection via DBSCAN clustering + heuristic 24h forecasting."""
import math
import logging
from datetime import datetime, timedelta

import numpy as np
from sklearn.cluster import DBSCAN

from models import db, Report, SensorReading, Hotspot
from ingestion import get_wind_data

logger = logging.getLogger(__name__)

GRID_SIZE = 0.002           # ~200m grid cells
LOOKBACK_HOURS = 6
DBSCAN_EPS_KM = 0.5
EARTH_RADIUS_KM = 6371.0
BASELINE_PM25 = 45.0        # city-wide baseline (µg/m³)

RESOURCE_MAP = {
    "burning": "Cleanup crew + Fire response unit + Water tanker",
    "smoke":   "Environmental inspector + Air quality monitor deployment",
    "dust":    "Water-mist cannon + Road-wetting vehicle",
    "other":   "General inspection team",
    "clear":   "No action required",
}


def _haversine_km(lat1, lon1, lat2, lon2):
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _latlon_to_grid(lat, lon):
    row = int(lat / GRID_SIZE)
    col = int(lon / GRID_SIZE)
    return f"{row}_{col}", row * GRID_SIZE + GRID_SIZE / 2, col * GRID_SIZE + GRID_SIZE / 2


def _pm25_to_aqi(pm25):
    """Simple PM2.5 → AQI estimate."""
    if pm25 is None:
        return None
    if pm25 <= 12:    return round(pm25 / 12 * 50)
    if pm25 <= 35.4:  return round(50 + (pm25 - 12) / (35.4 - 12) * 50)
    if pm25 <= 55.4:  return round(100 + (pm25 - 35.4) / (55.4 - 35.4) * 50)
    if pm25 <= 150.4: return round(150 + (pm25 - 55.4) / (150.4 - 55.4) * 100)
    return min(500, round(200 + (pm25 - 150.4) / 2))


def _severity_to_estimated_pm25(severity_score):
    """Convert hotspot severity score back to a rough PM2.5 estimate."""
    # severity 1 → ~30 µg/m³, severity 5 → ~250 µg/m³
    return round(BASELINE_PM25 * (0.5 + severity_score * 0.9), 1)


def _compute_confidence(source_types_set, report_count, sensor_count, satellite_count):
    """
    Confidence based on independent source corroboration — the core fusion value.
    HIGH:   3 independent source types, or 2 types with ≥3 citizen reports
    MEDIUM: 2 independent source types
    LOW:    single source type only
    """
    n_sources = len(source_types_set)
    if n_sources >= 3:
        return "high"
    if n_sources == 2:
        return "high" if report_count >= 3 else "medium"
    if report_count >= 4 or satellite_count >= 1:
        return "medium"
    return "low"


def _nearest_official_station(lat, lon, sensor_readings):
    """Find the closest sensor station and return its AQI + distance."""
    # Only use "real" stations (not virtual reports injected from sensors)
    real_stations = {}
    for sr in sensor_readings:
        sid = sr.station_id
        if sid not in real_stations:
            real_stations[sid] = sr
    if not real_stations:
        return None, None, None

    best_dist = float("inf")
    best_sr = None
    for sr in real_stations.values():
        d = _haversine_km(lat, lon, sr.lat, sr.lon)
        if d < best_dist:
            best_dist = d
            best_sr = sr

    if best_sr is None:
        return None, None, None
    return best_sr.station_name, round(best_dist, 2), best_sr.aqi


def _estimate_detection_gap(created_at, report_count, nearest_station_dist_km):
    """
    Estimate how many hours ahead of "official complaint-based detection" we flagged this.
    Heuristic:
    - Stations > 2km away rarely detect hyper-local events at all
    - Typical complaint-to-response lag is 4-8 hours
    - We detected it when the first reports came in
    """
    if nearest_station_dist_km and nearest_station_dist_km > 2.0:
        # Station too far to detect — gap = full typical response lag
        base_gap = 6.0
    elif nearest_station_dist_km and nearest_station_dist_km > 1.0:
        base_gap = 3.0
    else:
        base_gap = 1.5

    # More reports = event has been ongoing longer without official response
    report_bonus = min(2.0, report_count * 0.4)
    return round(base_gap + report_bonus, 1)


def run_hotspot_detection(app):
    """Main detection pipeline."""
    with app.app_context():
        try:
            cutoff = datetime.utcnow() - timedelta(hours=LOOKBACK_HOURS)
            reports = Report.query.filter(
                Report.timestamp >= cutoff,
                Report.category != "clear",
            ).all()

            sensor_readings = SensorReading.query.filter(
                SensorReading.timestamp >= cutoff
            ).all()

            # Inject virtual reports from sensors exceeding baseline
            for sr in sensor_readings:
                if sr.pm25 and sr.pm25 > BASELINE_PM25 * 1.5:
                    severity = min(5, int((sr.pm25 / BASELINE_PM25 - 1) * 2) + 1)
                    virtual = type("VirtualReport", (), {
                        "id": f"s_{sr.id}",
                        "lat": sr.lat,
                        "lon": sr.lon,
                        "category": "smoke",
                        "severity": severity,
                        "confidence": 0.8,
                        "source": "sensor",
                        "timestamp": sr.timestamp,
                    })()
                    reports.append(virtual)

            wind = get_wind_data()
            logger.info("Wind: %.1f m/s @ %d°", wind.get("speed", 0), wind.get("deg", 0))

            if len(reports) < 2:
                logger.info("Not enough reports to cluster (%d)", len(reports))
                return

            coords = np.array([[r.lat, r.lon] for r in reports])
            weights = np.array([r.severity * r.confidence for r in reports])

            eps_rad = DBSCAN_EPS_KM / EARTH_RADIUS_KM
            coords_rad = np.radians(coords)

            db_model = DBSCAN(eps=eps_rad, min_samples=2, algorithm="ball_tree", metric="haversine")
            labels = db_model.fit_predict(coords_rad)

            unique_labels = set(labels) - {-1}
            logger.info("DBSCAN found %d clusters from %d points", len(unique_labels), len(reports))

            for label in unique_labels:
                mask = labels == label
                cluster_reports = [reports[i] for i in range(len(reports)) if mask[i]]
                cluster_weights = weights[mask]
                cluster_coords = coords[mask]

                total_w = cluster_weights.sum()
                center_lat = float((cluster_coords[:, 0] * cluster_weights).sum() / total_w)
                center_lon = float((cluster_coords[:, 1] * cluster_weights).sum() / total_w)
                grid_cell_id, _, _ = _latlon_to_grid(center_lat, center_lon)

                severity_score = float(cluster_weights.mean())
                category = _dominant_category(cluster_reports)
                resource = RESOURCE_MAP.get(category, RESOURCE_MAP["other"])

                evidence_ids = [str(r.id) for r in cluster_reports if isinstance(r.id, int)]
                report_count = sum(1 for r in cluster_reports if r.source == "citizen")
                sensor_count = sum(1 for r in cluster_reports if r.source == "sensor")
                satellite_count = sum(1 for r in cluster_reports if r.source == "satellite")

                source_types_set = set()
                if report_count > 0:    source_types_set.add("citizen")
                if sensor_count > 0:    source_types_set.add("sensor")
                if satellite_count > 0: source_types_set.add("satellite")

                confidence_level = _compute_confidence(
                    source_types_set, report_count, sensor_count, satellite_count
                )

                forecast_score, forecast_trend = _compute_forecast(
                    center_lat, center_lon, cluster_reports, sensor_readings, wind
                )

                # Nearest official station + detection gap
                station_name, station_dist, station_aqi = _nearest_official_station(
                    center_lat, center_lon, sensor_readings
                )
                estimated_local_pm25 = _severity_to_estimated_pm25(severity_score)
                estimated_local_aqi = _pm25_to_aqi(estimated_local_pm25)
                detection_gap = _estimate_detection_gap(
                    datetime.utcnow(), report_count, station_dist
                )

                fields = dict(
                    center_lat=center_lat,
                    center_lon=center_lon,
                    severity_score=round(severity_score, 2),
                    forecast_score=round(forecast_score, 2),
                    forecast_trend=forecast_trend,
                    category=category,
                    recommended_resource=resource,
                    evidence_report_ids=",".join(evidence_ids),
                    report_count=report_count,
                    sensor_count=sensor_count,
                    satellite_count=satellite_count,
                    confidence_level=confidence_level,
                    source_types=",".join(sorted(source_types_set)),
                    nearest_station_name=station_name,
                    nearest_station_dist_km=station_dist,
                    nearest_station_aqi=station_aqi,
                    estimated_local_aqi=estimated_local_aqi,
                    detection_gap_hours=detection_gap,
                    wind_speed=wind.get("speed"),
                    wind_deg=wind.get("deg"),
                    updated_at=datetime.utcnow(),
                )

                existing = Hotspot.query.filter_by(grid_cell_id=grid_cell_id).filter(
                    Hotspot.status.in_(["active", "acknowledged"])
                ).first()

                if existing:
                    for k, v in fields.items():
                        setattr(existing, k, v)
                else:
                    db.session.add(Hotspot(grid_cell_id=grid_cell_id, status="active", **fields))

            db.session.commit()
            logger.info("Hotspot detection complete — %d clusters", len(unique_labels))

        except Exception as e:
            logger.exception("Hotspot detection failed: %s", e)


def _dominant_category(reports):
    cats = [r.category for r in reports if r.category and r.category != "clear"]
    if not cats:
        return "other"
    return max(set(cats), key=cats.count)


def _compute_forecast(lat, lon, cluster_reports, all_sensors, wind=None):
    now = datetime.utcnow()
    hour = now.hour

    if 7 <= hour <= 10 or 17 <= hour <= 21:
        tod_factor = 1.2
    elif 0 <= hour <= 5:
        tod_factor = 0.8
    else:
        tod_factor = 1.0

    recent_cutoff = now - timedelta(hours=1)
    recent = [r for r in cluster_reports if r.timestamp >= recent_cutoff]
    older  = [r for r in cluster_reports if r.timestamp < recent_cutoff]

    recent_avg = (sum(r.severity for r in recent) / len(recent)) if recent else 0
    older_avg  = (sum(r.severity for r in older)  / len(older))  if older  else recent_avg

    base_score = (sum(r.severity * r.confidence for r in cluster_reports) /
                  len(cluster_reports)) if cluster_reports else 2.0

    sources = {r.source for r in cluster_reports}
    diversity_bonus = 0.3 * (len(sources) - 1)

    wind_factor = 1.0
    if wind:
        speed = wind.get("speed", 0)
        if speed > 8:   wind_factor = 0.75
        elif speed > 5: wind_factor = 0.88
        elif speed < 1: wind_factor = 1.15

    forecast = round(min(5.0, base_score * tod_factor * wind_factor + diversity_bonus), 2)

    if recent_avg > older_avg + 0.3:
        trend = "worsening"
    elif recent_avg < older_avg - 0.3:
        trend = "improving"
    elif wind_factor < 0.85:
        trend = "improving"
    else:
        trend = "stable"

    return forecast, trend
