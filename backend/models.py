from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from typing import Any

db = SQLAlchemy()


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    lat = db.Column(db.Float, nullable=False)
    lon = db.Column(db.Float, nullable=False)
    photo_url = db.Column(db.String(512))
    category = db.Column(db.String(50))
    severity = db.Column(db.Integer)
    confidence = db.Column(db.Float)
    source = db.Column(db.String(20))
    description = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "lat": self.lat,
            "lon": self.lon,
            "photo_url": self.photo_url,
            "category": self.category,
            "severity": self.severity,
            "confidence": self.confidence,
            "source": self.source,
            "description": self.description,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


class SensorReading(db.Model):
    __tablename__ = "sensor_readings"

    id = db.Column(db.Integer, primary_key=True)
    station_id = db.Column(db.String(100))
    station_name = db.Column(db.String(200))
    lat = db.Column(db.Float, nullable=False)
    lon = db.Column(db.Float, nullable=False)
    pm25 = db.Column(db.Float)
    pm10 = db.Column(db.Float)
    co = db.Column(db.Float)
    no2 = db.Column(db.Float)
    aqi = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "station_id": self.station_id,
            "station_name": self.station_name,
            "lat": self.lat,
            "lon": self.lon,
            "pm25": self.pm25,
            "pm10": self.pm10,
            "co": self.co,
            "no2": self.no2,
            "aqi": self.aqi,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


class Hotspot(db.Model):
    __tablename__ = "hotspots"

    id = db.Column(db.Integer, primary_key=True)
    grid_cell_id = db.Column(db.String(50))
    center_lat = db.Column(db.Float, nullable=False)
    center_lon = db.Column(db.Float, nullable=False)
    severity_score = db.Column(db.Float)
    forecast_score = db.Column(db.Float)
    forecast_trend = db.Column(db.String(20))
    status = db.Column(db.String(20), default="active")
    category = db.Column(db.String(50))
    recommended_resource = db.Column(db.String(200))
    evidence_report_ids = db.Column(db.Text)
    report_count = db.Column(db.Integer, default=0)
    sensor_count = db.Column(db.Integer, default=0)
    satellite_count = db.Column(db.Integer, default=0)

    # --- New fields for "solving the challenge" ---
    # Multi-source confidence
    confidence_level = db.Column(db.String(10), default="low")   # low|medium|high
    source_types = db.Column(db.String(100))                      # e.g. "citizen,sensor,satellite"

    # Detection gap: nearest official station couldn't see this
    nearest_station_name = db.Column(db.String(200))
    nearest_station_dist_km = db.Column(db.Float)
    nearest_station_aqi = db.Column(db.Float)                     # what official AQI shows
    estimated_local_aqi = db.Column(db.Float)                     # our hyper-local estimate
    detection_gap_hours = db.Column(db.Float)                     # how many hours ahead of official

    # Wind / plume forecast
    wind_speed = db.Column(db.Float)
    wind_deg = db.Column(db.Integer)

    acknowledged_by = db.Column(db.String(100))
    acknowledged_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "grid_cell_id": self.grid_cell_id,
            "center_lat": self.center_lat,
            "center_lon": self.center_lon,
            "severity_score": self.severity_score,
            "forecast_score": self.forecast_score,
            "forecast_trend": self.forecast_trend,
            "status": self.status,
            "category": self.category,
            "recommended_resource": self.recommended_resource,
            "evidence_report_ids": self.evidence_report_ids.split(",") if self.evidence_report_ids else [],
            "report_count": self.report_count,
            "sensor_count": self.sensor_count,
            "satellite_count": self.satellite_count,
            "confidence_level": self.confidence_level or "low",
            "source_types": self.source_types.split(",") if self.source_types else [],
            "nearest_station_name": self.nearest_station_name,
            "nearest_station_dist_km": self.nearest_station_dist_km,
            "nearest_station_aqi": self.nearest_station_aqi,
            "estimated_local_aqi": self.estimated_local_aqi,
            "detection_gap_hours": self.detection_gap_hours,
            "wind_speed": self.wind_speed,
            "wind_deg": self.wind_deg,
            "acknowledged_by": self.acknowledged_by,
            "acknowledged_at": self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
