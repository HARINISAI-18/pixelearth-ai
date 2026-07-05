"""Data ingestion: OpenAQ sensors, NASA FIRMS satellite, OpenWeatherMap wind."""
import os
import math
import random
import logging
from datetime import datetime, timedelta

import requests
from models import db, Report, SensorReading

logger = logging.getLogger(__name__)

CITY_LAT = float(os.getenv("CITY_LAT", "13.0827"))
CITY_LON = float(os.getenv("CITY_LON", "80.2707"))
BBOX_N = float(os.getenv("CITY_BBOX_N", "13.2"))
BBOX_S = float(os.getenv("CITY_BBOX_S", "12.9"))
BBOX_E = float(os.getenv("CITY_BBOX_E", "80.4"))
BBOX_W = float(os.getenv("CITY_BBOX_W", "80.0"))
OWM_KEY = os.getenv("OPENWEATHER_API_KEY", "")
FIRMS_KEY = os.getenv("NASA_FIRMS_API_KEY", "")


def fetch_openaq_readings(app):
    """Pull latest PM2.5/PM10/CO/NO2 readings from OpenAQ for bounding box."""
    with app.app_context():
        try:
            url = "https://api.openaq.org/v2/measurements"
            params = {
                "coordinates": f"{CITY_LAT},{CITY_LON}",
                "radius": 25000,
                "parameter": ["pm25", "pm10", "co", "no2"],
                "limit": 100,
                "order_by": "datetime",
                "sort": "desc",
            }
            resp = requests.get(url, params=params, timeout=15)
            if resp.status_code != 200:
                logger.warning("OpenAQ returned %s", resp.status_code)
                _seed_synthetic_sensors(app)
                return

            data = resp.json().get("results", [])
            if not data:
                _seed_synthetic_sensors(app)
                return

            # Group by location
            stations = {}
            for item in data:
                loc = item.get("location")
                if not loc:
                    continue
                coords = item.get("coordinates", {})
                lat = coords.get("latitude")
                lon = coords.get("longitude")
                if lat is None or lon is None:
                    continue
                if loc not in stations:
                    stations[loc] = {"lat": lat, "lon": lon, "name": loc, "params": {}}
                param = item.get("parameter")
                value = item.get("value")
                if param and value is not None:
                    stations[loc]["params"][param] = value

            for station_id, s in stations.items():
                reading = SensorReading(
                    station_id=station_id,
                    station_name=s["name"],
                    lat=s["lat"],
                    lon=s["lon"],
                    pm25=s["params"].get("pm25"),
                    pm10=s["params"].get("pm10"),
                    co=s["params"].get("co"),
                    no2=s["params"].get("no2"),
                    aqi=_calc_aqi(s["params"].get("pm25")),
                    timestamp=datetime.utcnow(),
                )
                db.session.add(reading)
            db.session.commit()
            logger.info("OpenAQ: ingested %d station readings", len(stations))
        except Exception as e:
            logger.error("OpenAQ ingestion failed: %s", e)
            _seed_synthetic_sensors(app)


def fetch_firms_data(app):
    """Pull NASA FIRMS fire hotspot data."""
    with app.app_context():
        try:
            if not FIRMS_KEY:
                logger.warning("No FIRMS key — skipping satellite ingest")
                _seed_synthetic_satellite(app)
                return

            bbox = f"{BBOX_W},{BBOX_S},{BBOX_E},{BBOX_N}"
            url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{FIRMS_KEY}/VIIRS_SNPP_NRT/{bbox}/1"
            resp = requests.get(url, timeout=20)
            if resp.status_code != 200:
                logger.warning("FIRMS returned %s", resp.status_code)
                _seed_synthetic_satellite(app)
                return

            lines = resp.text.strip().split("\n")
            count = 0
            for line in lines[1:]:  # skip header
                parts = line.split(",")
                if len(parts) < 4:
                    continue
                try:
                    lat = float(parts[0])
                    lon = float(parts[1])
                    frp = float(parts[2]) if parts[2] else 1.0  # fire radiative power
                    severity = min(5, max(1, int(frp / 5) + 1))
                    report = Report(  # type: ignore[unexpected-keyword]
                        lat=lat,
                        lon=lon,
                        category="burning",
                        severity=severity,
                        confidence=0.85,
                        source="satellite",
                        description=f"NASA FIRMS fire detection, FRP={frp}",
                        timestamp=datetime.utcnow(),
                    )
                    db.session.add(report)
                    count += 1
                except (ValueError, IndexError):
                    continue
            db.session.commit()
            logger.info("FIRMS: ingested %d fire pixels", count)
        except Exception as e:
            logger.error("FIRMS ingestion failed: %s", e)
            _seed_synthetic_satellite(app)


def get_wind_data():
    """Return current wind speed and direction for the city."""
    if not OWM_KEY:
        return {"speed": 3.0, "deg": 225, "description": "synthetic"}
    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        resp = requests.get(url, params={"lat": CITY_LAT, "lon": CITY_LON, "appid": OWM_KEY}, timeout=10)
        if resp.status_code == 200:
            wind = resp.json().get("wind", {})
            return {"speed": wind.get("speed", 3.0), "deg": wind.get("deg", 225), "description": "live"}
    except Exception as e:
        logger.warning("OWM wind fetch failed: %s", e)
    return {"speed": 3.0, "deg": 225, "description": "fallback"}


def _calc_aqi(pm25):
    """Simple PM2.5 → AQI estimate."""
    if pm25 is None:
        return None
    if pm25 <= 12:
        return round(pm25 / 12 * 50)
    if pm25 <= 35.4:
        return round(50 + (pm25 - 12) / (35.4 - 12) * 50)
    if pm25 <= 55.4:
        return round(100 + (pm25 - 35.4) / (55.4 - 35.4) * 50)
    if pm25 <= 150.4:
        return round(150 + (pm25 - 55.4) / (150.4 - 55.4) * 100)
    return min(500, round(200 + (pm25 - 150.4) / 2))


# ── Synthetic / demo data ─────────────────────────────────────────────────────

DEMO_HOTSPOT_LOCATIONS = [
    # (lat, lon, label, type)
    (13.0569, 80.2425, "Kodungaiyur Dump", "burning"),
    (13.0827, 80.2707, "Anna Salai Junction", "dust"),
    (13.1067, 80.2785, "Ambattur Industrial", "smoke"),
    (13.0350, 80.2650, "Pallikaranai Wetland", "burning"),
    (13.0900, 80.2900, "Royapuram Harbour", "smoke"),
]


def _seed_synthetic_sensors(app):
    """Insert plausible synthetic sensor readings for demo."""
    with app.app_context():
        cutoff = datetime.utcnow() - timedelta(minutes=30)
        recent = SensorReading.query.filter(SensorReading.timestamp > cutoff).count()
        if recent > 5:
            return  # already seeded recently

        stations = [
            ("ST001", "Kodungaiyur Station", 13.0569, 80.2425, 180, 210, 1.2, 85),
            ("ST002", "Anna Salai Monitor", 13.0827, 80.2707, 95, 110, 0.5, 45),
            ("ST003", "Ambattur CPCB", 13.1067, 80.2785, 145, 165, 0.9, 65),
            ("ST004", "T Nagar Monitor", 13.0418, 80.2341, 60, 75, 0.3, 30),
            ("ST005", "Pallikaranai Stn", 13.0350, 80.2650, 200, 230, 1.5, 90),
            ("ST006", "Royapuram Port", 13.0900, 80.2900, 120, 140, 0.7, 55),
        ]
        for sid, name, lat, lon, pm25, pm10, co, no2 in stations:
            jitter = lambda v: round(v * (0.9 + random.random() * 0.2), 1)
            reading = SensorReading(
                station_id=sid,
                station_name=name,
                lat=lat,
                lon=lon,
                pm25=jitter(pm25),
                pm10=jitter(pm10),
                co=jitter(co),
                no2=jitter(no2),
                aqi=_calc_aqi(jitter(pm25)),
                timestamp=datetime.utcnow(),
            )
            db.session.add(reading)
        db.session.commit()
        logger.info("Seeded synthetic sensor readings")


def _seed_synthetic_satellite(app):
    """Insert plausible FIRMS-like fire detections for demo."""
    with app.app_context():
        cutoff = datetime.utcnow() - timedelta(hours=4)
        recent = Report.query.filter(Report.source == "satellite", Report.timestamp > cutoff).count()
        if recent > 2:
            return

        fires = [
            (13.0560, 80.2430, 4, "NASA FIRMS thermal anomaly near Kodungaiyur"),
            (13.0348, 80.2655, 3, "NASA FIRMS fire pixel — Pallikaranai"),
        ]
        for lat, lon, sev, desc in fires:
            r = Report(lat=lat, lon=lon, category="burning", severity=sev,  # type: ignore[unexpected-keyword]
                       confidence=0.85, source="satellite", description=desc,
                       timestamp=datetime.utcnow())
            db.session.add(r)
        db.session.commit()
        logger.info("Seeded synthetic satellite reports")


def seed_demo_citizen_reports(app):
    """Seed realistic citizen reports for demo purposes."""
    with app.app_context():
        existing = Report.query.filter(Report.source == "citizen").count()
        if existing > 10:
            return

        reports = [
            (13.0571, 80.2428, "smoke", 4, 0.9, "Thick black smoke from dump, can barely see the road"),
            (13.0565, 80.2420, "burning", 5, 0.95, "Garbage fire — flames visible, horrible smell"),
            (13.0568, 80.2432, "smoke", 3, 0.8, "Smoke since morning, eyes burning"),
            (13.1068, 80.2788, "smoke", 4, 0.88, "Factory chimney output very heavy today"),
            (13.1065, 80.2782, "smoke", 3, 0.75, "Industrial area smells of chemicals"),
            (13.0830, 80.2710, "dust", 3, 0.7, "Construction dust everywhere near junction"),
            (13.0825, 80.2705, "dust", 2, 0.65, "Very dusty — road work and heavy traffic"),
            (13.0352, 80.2652, "burning", 4, 0.9, "Open burning near wetland edge"),
            (13.0903, 80.2902, "smoke", 3, 0.72, "Port machinery smoke, strong diesel smell"),
        ]
        base_time = datetime.utcnow() - timedelta(hours=2)
        for i, (lat, lon, cat, sev, conf, desc) in enumerate(reports):
            r = Report(  # type: ignore[unexpected-keyword]
                lat=lat + random.uniform(-0.001, 0.001),
                lon=lon + random.uniform(-0.001, 0.001),
                category=cat,
                severity=sev,
                confidence=conf,
                source="citizen",
                description=desc,
                timestamp=base_time + timedelta(minutes=i * 12),
            )
            db.session.add(r)
        db.session.commit()
        logger.info("Seeded demo citizen reports")
