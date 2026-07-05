export interface Report {
  id: number;
  lat: number;
  lon: number;
  photo_url: string | null;
  category: string;
  severity: number;
  confidence: number;
  source: "citizen" | "sensor" | "satellite";
  description: string;
  timestamp: string;
}

export interface SensorReading {
  id: number;
  station_id: string;
  station_name: string;
  lat: number;
  lon: number;
  pm25: number | null;
  pm10: number | null;
  co: number | null;
  no2: number | null;
  aqi: number | null;
  timestamp: string;
}

export interface Hotspot {
  id: number;
  grid_cell_id: string;
  center_lat: number;
  center_lon: number;
  severity_score: number;
  forecast_score: number;
  forecast_trend: "worsening" | "stable" | "improving";
  status: "active" | "acknowledged" | "dispatched" | "resolved";
  category: string;
  recommended_resource: string;
  evidence_report_ids: string[];
  report_count: number;
  sensor_count: number;
  satellite_count: number;

  // Multi-source fusion confidence
  confidence_level: "low" | "medium" | "high";
  source_types: string[];

  // Detection gap — the core value prop
  nearest_station_name: string | null;
  nearest_station_dist_km: number | null;
  nearest_station_aqi: number | null;
  estimated_local_aqi: number | null;
  detection_gap_hours: number | null;

  // Wind / plume forecast
  wind_speed: number | null;
  wind_deg: number | null;

  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
  evidence?: Report[];
}

export interface MapData {
  hotspots: Hotspot[];
  sensors: SensorReading[];
  reports: Report[];
}

export interface Stats {
  active_hotspots: number;
  total_reports: number;
  citizen_reports: number;
  dispatched: number;
  resolved: number;
}

export interface TacticalPlan {
  hotspot_id: number;
  trust_index: number;
  corroboration_summary: string;
  recommended_resource: string;
  estimated_exposure_prevented: number;
  tactical_steps: string[];
  generated_at: string;
}

