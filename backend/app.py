"""Flask application entry point."""
import os
import logging
from pathlib import Path

from flask import Flask
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

load_dotenv()

from models import db
from routes import bp, register_upload_route, limiter
from ingestion import fetch_openaq_readings, fetch_firms_data, seed_demo_citizen_reports
from hotspot_engine import run_hotspot_detection

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def _migrate_db(app):
    """Add new columns to existing SQLite DB without dropping data."""
    new_cols = [
        ("hotspots", "confidence_level",         "VARCHAR(10)"),
        ("hotspots", "source_types",              "VARCHAR(100)"),
        ("hotspots", "nearest_station_name",      "VARCHAR(200)"),
        ("hotspots", "nearest_station_dist_km",   "FLOAT"),
        ("hotspots", "nearest_station_aqi",       "FLOAT"),
        ("hotspots", "estimated_local_aqi",       "FLOAT"),
        ("hotspots", "detection_gap_hours",       "FLOAT"),
        ("hotspots", "wind_speed",                "FLOAT"),
        ("hotspots", "wind_deg",                  "INTEGER"),
    ]
    with db.engine.connect() as conn:
        for table, col, col_type in new_cols:
            try:
                conn.execute(db.text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
                logger.info("Migration: added %s.%s", table, col)
            except Exception:
                pass  # column already exists


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-me")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///pollution.db")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max upload

    CORS(app, resources={r"/api/*": {"origins": "*"}, r"/uploads/*": {"origins": "*"}})

    db.init_app(app)
    limiter.init_app(app)

    app.register_blueprint(bp)
    register_upload_route(app)

    with app.app_context():
        db.create_all()
        _migrate_db(app)
        logger.info("Database tables created/migrated")
        seed_demo_citizen_reports(app)
        from ingestion import _seed_synthetic_sensors, _seed_synthetic_satellite
        _seed_synthetic_sensors(app)
        _seed_synthetic_satellite(app)
        run_hotspot_detection(app)

    # Background scheduler for periodic ingestion
    scheduler = BackgroundScheduler()
    scheduler.add_job(fetch_openaq_readings, "interval", minutes=30, args=[app], id="openaq")
    scheduler.add_job(fetch_firms_data, "interval", hours=3, args=[app], id="firms")
    scheduler.add_job(run_hotspot_detection, "interval", minutes=15, args=[app], id="hotspot")
    scheduler.start()

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5001))
    logger.info("Starting server on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=False)
