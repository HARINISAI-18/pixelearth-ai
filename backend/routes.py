"""Flask route definitions."""
import os
import uuid
import logging
from datetime import datetime
from pathlib import Path

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from models import db, Report, SensorReading, Hotspot
from classification import classify_photo
from hotspot_engine import run_hotspot_detection
from ingestion import fetch_openaq_readings, fetch_firms_data, seed_demo_citizen_reports

bp = Blueprint("api", __name__, url_prefix="/api")
logger = logging.getLogger(__name__)

# Rate limiter — initialized against the app in create_app(), referenced here for decorators
limiter = Limiter(key_func=get_remote_address, default_limits=[])

UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", "uploads"))
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _allowed(filename):
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


# ── Citizen reporting ─────────────────────────────────────────────────────────

@bp.route("/reports", methods=["POST"])
@limiter.limit("10 per minute; 50 per hour")
def submit_report():
    """Accept a citizen pollution report with optional photo."""
    lat = request.form.get("lat") or (request.json or {}).get("lat")
    lon = request.form.get("lon") or (request.json or {}).get("lon")
    category = request.form.get("category") or (request.json or {}).get("category", "other")
    description = request.form.get("description") or (request.json or {}).get("description", "")

    if lat is None or lon is None:
        return jsonify({"error": "lat and lon are required"}), 400

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return jsonify({"error": "lat/lon must be numeric"}), 400

    photo_url = None
    severity = int(request.form.get("severity", 3) or 3)
    confidence = 0.7
    classified_category = category

    file = request.files.get("photo")
    if file and file.filename and _allowed(file.filename):
        ext = Path(file.filename).suffix.lower()
        filename = f"{uuid.uuid4().hex}{ext}"
        UPLOAD_FOLDER.mkdir(exist_ok=True)
        save_path = UPLOAD_FOLDER / filename
        file.save(str(save_path))
        photo_url = f"/uploads/{filename}"

        # Run classification asynchronously — for hackathon, do it synchronously
        result = classify_photo(str(save_path))
        classified_category = result.get("category", category)
        severity = result.get("severity", severity)
        confidence = result.get("confidence", confidence)
        if result.get("description"):
            description = result["description"]

    report = Report(  # type: ignore[unexpected-keyword]
        lat=lat,
        lon=lon,
        photo_url=photo_url,
        category=classified_category,
        severity=severity,
        confidence=confidence,
        source="citizen",
        description=description,
        timestamp=datetime.utcnow(),
    )
    db.session.add(report)
    db.session.commit()

    # Re-run hotspot detection after new report
    try:
        run_hotspot_detection(current_app._get_current_object())
    except Exception as e:
        logger.warning("Post-report hotspot update failed: %s", e)

    return jsonify({"success": True, "report": report.to_dict()}), 201


@bp.route("/reports", methods=["GET"])
def list_reports():
    limit = min(int(request.args.get("limit", 100)), 500)
    source = request.args.get("source")
    q = Report.query.order_by(Report.timestamp.desc())
    if source:
        q = q.filter(Report.source == source)
    reports = q.limit(limit).all()
    return jsonify([r.to_dict() for r in reports])


# ── Hotspots ──────────────────────────────────────────────────────────────────

@bp.route("/hotspots", methods=["GET"])
def list_hotspots():
    status = request.args.get("status")
    q = Hotspot.query.order_by(Hotspot.severity_score.desc())
    if status:
        q = q.filter(Hotspot.status == status)
    else:
        q = q.filter(Hotspot.status.in_(["active", "acknowledged", "dispatched"]))
    hotspots = q.all()
    return jsonify([h.to_dict() for h in hotspots])


@bp.route("/hotspots/<int:hotspot_id>", methods=["GET"])
def get_hotspot(hotspot_id):
    h = Hotspot.query.get_or_404(hotspot_id)
    data = h.to_dict()

    # Attach evidence reports
    if h.evidence_report_ids:
        ids = [int(i) for i in h.evidence_report_ids.split(",") if i.isdigit()]
        reports = Report.query.filter(Report.id.in_(ids)).all()
        data["evidence"] = [r.to_dict() for r in reports]
    else:
        data["evidence"] = []

    return jsonify(data)


@bp.route("/hotspots/<int:hotspot_id>/status", methods=["PATCH"])
def update_hotspot_status(hotspot_id):
    h = Hotspot.query.get_or_404(hotspot_id)
    body = request.json or {}
    new_status = body.get("status")
    valid = {"active", "acknowledged", "dispatched", "resolved"}
    if new_status not in valid:
        return jsonify({"error": f"status must be one of {valid}"}), 400

    h.status = new_status
    h.updated_at = datetime.utcnow()
    if new_status in ("acknowledged", "dispatched"):
        h.acknowledged_by = body.get("officer", "Unknown Officer")
        h.acknowledged_at = datetime.utcnow()
    db.session.commit()
    return jsonify(h.to_dict())


# ── Sensors ───────────────────────────────────────────────────────────────────

@bp.route("/sensors", methods=["GET"])
def list_sensors():
    readings = (SensorReading.query
                .order_by(SensorReading.timestamp.desc())
                .limit(50)
                .all())
    return jsonify([r.to_dict() for r in readings])


# ── Map / stats ───────────────────────────────────────────────────────────────

@bp.route("/map-data", methods=["GET"])
def map_data():
    """Return all data needed to render the map in one call."""
    hotspots = (Hotspot.query
                .filter(Hotspot.status.in_(["active", "acknowledged", "dispatched"]))
                .order_by(Hotspot.severity_score.desc())
                .all())
    sensors = (SensorReading.query
               .order_by(SensorReading.timestamp.desc())
               .limit(30)
               .all())
    recent_reports = (Report.query
                      .order_by(Report.timestamp.desc())
                      .limit(50)
                      .all())
    return jsonify({
        "hotspots": [h.to_dict() for h in hotspots],
        "sensors": [s.to_dict() for s in sensors],
        "reports": [r.to_dict() for r in recent_reports],
    })


@bp.route("/stats", methods=["GET"])
def stats():
    active = Hotspot.query.filter_by(status="active").count()
    total_reports = Report.query.count()
    citizen_reports = Report.query.filter_by(source="citizen").count()
    dispatched = Hotspot.query.filter_by(status="dispatched").count()
    resolved = Hotspot.query.filter_by(status="resolved").count()
    return jsonify({
        "active_hotspots": active,
        "total_reports": total_reports,
        "citizen_reports": citizen_reports,
        "dispatched": dispatched,
        "resolved": resolved,
    })


# ── Historical / analyst view (FR-21) ────────────────────────────────────────

@bp.route("/analytics/hotspot-history", methods=["GET"])
def hotspot_history():
    """
    Return all hotspots (including resolved) with their grid cell and timestamps,
    grouped for frequency analysis. Used by the analyst historical heatmap view.
    """
    from sqlalchemy import func
    days = min(int(request.args.get("days", 30)), 90)
    cutoff = datetime.utcnow() - __import__("datetime").timedelta(days=days)

    hotspots = (Hotspot.query
                .filter(Hotspot.created_at >= cutoff)
                .order_by(Hotspot.created_at.desc())
                .all())

    # Frequency aggregation by grid cell
    cell_freq: dict = {}
    for h in hotspots:
        key = h.grid_cell_id
        if key not in cell_freq:
            cell_freq[key] = {
                "grid_cell_id": key,
                "center_lat": h.center_lat,
                "center_lon": h.center_lon,
                "count": 0,
                "max_severity": 0.0,
                "categories": [],
            }
        cell_freq[key]["count"] += 1
        cell_freq[key]["max_severity"] = max(cell_freq[key]["max_severity"], h.severity_score or 0)
        if h.category and h.category not in cell_freq[key]["categories"]:
            cell_freq[key]["categories"].append(h.category)

    return jsonify({
        "days": days,
        "total_hotspots": len(hotspots),
        "hotspots": [h.to_dict() for h in hotspots],
        "frequency_by_cell": sorted(cell_freq.values(), key=lambda x: x["count"], reverse=True),
    })


@bp.route("/analytics/report-timeline", methods=["GET"])
def report_timeline():
    """Return hourly report counts for the last N days — for the analyst trend chart."""
    from collections import defaultdict
    days = min(int(request.args.get("days", 7)), 30)
    cutoff = datetime.utcnow() - __import__("datetime").timedelta(days=days)

    reports = Report.query.filter(Report.timestamp >= cutoff).all()

    hourly: dict = defaultdict(lambda: {"citizen": 0, "sensor": 0, "satellite": 0, "total": 0})
    for r in reports:
        if r.timestamp:
            bucket = r.timestamp.strftime("%Y-%m-%dT%H:00:00")
            hourly[bucket][r.source] = hourly[bucket].get(r.source, 0) + 1
            hourly[bucket]["total"] += 1

    return jsonify({
        "days": days,
        "timeline": [{"hour": k, **v} for k, v in sorted(hourly.items())],
    })


# ── Admin / data refresh ──────────────────────────────────────────────────────

@bp.route("/refresh", methods=["POST"])
def refresh_data():
    """Manually trigger data ingestion and hotspot detection."""
    app = current_app._get_current_object()
    fetch_openaq_readings(app)
    fetch_firms_data(app)
    run_hotspot_detection(app)
    return jsonify({"success": True, "message": "Data refresh triggered"})


@bp.route("/seed-demo", methods=["POST"])
def seed_demo():
    """Seed demo data for presentations."""
    app = current_app._get_current_object()
    seed_demo_citizen_reports(app)
    from ingestion import _seed_synthetic_sensors, _seed_synthetic_satellite
    _seed_synthetic_sensors(app)
    _seed_synthetic_satellite(app)
    run_hotspot_detection(app)
    return jsonify({"success": True, "message": "Demo data seeded"})


@bp.route("/demo/trigger-scenario", methods=["POST"])
def trigger_scenario():
    """Trigger real-time interactive demo scenarios for hackathon presentations."""
    scenario = (request.json or {}).get("scenario", "dump_fire")
    app = current_app._get_current_object()

    with app.app_context():
        if scenario == "dump_fire":
            base_lat, base_lon = 13.0569, 80.2425
            reports = [
                (base_lat + 0.0005, base_lon - 0.0003, "burning", 5, 0.96, "CRITICAL: Massive garbage dump fire! Thick black toxic smoke billowing across residential block."),
                (base_lat - 0.0004, base_lon + 0.0002, "smoke", 5, 0.94, "Flames spreading rapidly across waste pile. Heavy breathing difficulty reported."),
                (base_lat + 0.0002, base_lon + 0.0004, "burning", 4, 0.90, "Acrid chemical smell and open flames visible from nearby road.")
            ]
            for lat, lon, cat, sev, conf, desc in reports:
                r = Report(lat=lat, lon=lon, category=cat, severity=sev, confidence=conf,  # type: ignore[unexpected-keyword]
                           source="citizen", description=desc, timestamp=datetime.utcnow())
                db.session.add(r)
            sat = Report(lat=base_lat, lon=base_lon, category="burning", severity=5, confidence=0.95,  # type: ignore[unexpected-keyword]
                         source="satellite", description="NASA FIRMS Real-Time VIIRS Thermal Anomaly (High Confidence)",
                         timestamp=datetime.utcnow())
            db.session.add(sat)
            db.session.commit()

        elif scenario == "rush_hour_smog":
            base_lat, base_lon = 13.0827, 80.2707
            reports = [
                (base_lat + 0.0003, base_lon - 0.0002, "dust", 4, 0.88, "Severe traffic gridlock generating massive exhaust smog and dust cloud."),
                (base_lat - 0.0002, base_lon + 0.0003, "smoke", 4, 0.85, "Heavy diesel fumes and visibility reduced at junction."),
                (base_lat + 0.0004, base_lon + 0.0001, "dust", 4, 0.82, "Road construction plus idling buses creating unbearable dust trap.")
            ]
            for lat, lon, cat, sev, conf, desc in reports:
                r = Report(lat=lat, lon=lon, category=cat, severity=sev, confidence=conf,  # type: ignore[unexpected-keyword]
                           source="citizen", description=desc, timestamp=datetime.utcnow())
                db.session.add(r)
            db.session.commit()

        elif scenario == "clear_recent":
            cutoff = datetime.utcnow() - __import__("datetime").timedelta(minutes=30)
            Report.query.filter(Report.timestamp >= cutoff).delete()
            db.session.commit()

        run_hotspot_detection(app)

    return jsonify({"success": True, "scenario": scenario, "message": f"Scenario '{scenario}' triggered successfully!"})


@bp.route("/hotspots/<int:hotspot_id>/tactical-plan", methods=["POST", "GET"])
def get_tactical_plan(hotspot_id):
    """Generate or retrieve an AI Tactical Dispatch Plan for a hotspot."""
    hotspot = Hotspot.query.get_or_404(hotspot_id)

    evidence_count = len(hotspot.evidence_report_ids or [])
    trust_score = 95 if hotspot.confidence_level == "high" else (82 if hotspot.confidence_level == "medium" else 68)
    if evidence_count > 3:
        trust_score = min(99, trust_score + 4)

    wind_deg = hotspot.wind_deg or 135
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    idx = int(round(wind_deg / 45)) % 8
    downwind_dir = dirs[(idx + 4) % 8]
    wind_spd = hotspot.wind_speed or 3.5

    cat = hotspot.category or "smoke"
    sev = hotspot.severity_score or 3.0

    if cat == "burning":
        steps = [
            f"1. Immediate Dispatch: Send 2x Heavy-Duty Cleanup & Fire Response units to grid sector ({hotspot.center_lat:.4f}, {hotspot.center_lon:.4f}).",
            f"2. Plume Containment: Deploy 5000L Water-Mist Cannon upwind to suppress toxic particulate drift moving {downwind_dir} at {wind_spd} m/s.",
            f"3. Community Advisory: Trigger automated SMS/WhatsApp advisory to residential associations within 1.2km {downwind_dir} to keep windows closed.",
            "4. Interdepartmental Escalation: Notify Solid Waste Management department regarding unauthorized open dumping/burning."
        ]
        resource = "Cleanup Crew + Fire Response + Mist Cannon"
    elif cat == "dust":
        steps = [
            f"1. Immediate Dispatch: Deploy 2x Anti-Smog Water-Mist Cannons along major thoroughfare near ({hotspot.center_lat:.4f}, {hotspot.center_lon:.4f}).",
            f"2. Traffic Management: Request Traffic Police diversion for heavy diesel vehicles to reduce localized NO2/PM10 entrapment.",
            f"3. Construction Audit: Inspect nearby active construction sites for dust suppression compliance (green netting and water spraying).",
            f"4. Continuous Monitoring: Increase OpenAQ polling frequency to 10-minute intervals to track dispersion towards {downwind_dir}."
        ]
        resource = "Water-Mist Cannon + Traffic Police Notification"
    else:
        steps = [
            f"1. Rapid Assessment: Dispatch Ward Environmental Inspector to coordinates ({hotspot.center_lat:.4f}, {hotspot.center_lon:.4f}) within 30 minutes.",
            f"2. Air Scrubbing: Position mobile water-sprinkler unit upwind to mitigate PM2.5 plume drifting {downwind_dir} at {wind_spd} m/s.",
            f"3. Vulnerable Zone Alert: Check proximity to schools and hospitals within 800m downwind; issue precautionary indoor notice if AQI exceeds 250.",
            "4. Source Verification: Cross-reference industrial shift schedules and generator usage in the immediate 500m radius."
        ]
        resource = "Mobile Mist Cannon + Inspector Dispatch"

    return jsonify({
        "hotspot_id": hotspot.id,
        "trust_index": trust_score,
        "corroboration_summary": f"Corroborated by {evidence_count} citizen reports, local sensor deviation, and wind vector analysis.",
        "recommended_resource": resource,
        "estimated_exposure_prevented": int(sev * 1250 + evidence_count * 320),
        "tactical_steps": steps,
        "generated_at": datetime.utcnow().isoformat()
    })


# ── Static uploads ────────────────────────────────────────────────────────────

def register_upload_route(flask_app):
    @flask_app.route("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(str(UPLOAD_FOLDER.resolve()), filename)
