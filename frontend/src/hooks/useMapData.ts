import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import type { MapData, Stats } from "../types";

export function useMapData(intervalMs = 30000) {
  const [data, setData] = useState<MapData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [mapData, statsData] = await Promise.all([api.getMapData(), api.getStats()]);
      setData(mapData);
      setStats(statsData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    const handleEvent = () => { refresh(); };
    window.addEventListener("refresh-map-data", handleEvent);
    return () => {
      clearInterval(id);
      window.removeEventListener("refresh-map-data", handleEvent);
    };
  }, [refresh, intervalMs]);

  return { data, stats, loading, error, refresh };
}
