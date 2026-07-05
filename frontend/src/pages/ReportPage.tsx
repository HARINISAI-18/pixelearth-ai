import { useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { Camera, MapPin, Send, CheckCircle, AlertCircle, X } from "lucide-react";
import L from "leaflet";
import { api } from "../api";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CATEGORIES = [
  { value: "smoke", label: "Smoke", icon: "🌫️", description: "Visible smoke from any source" },
  { value: "dust", label: "Dust", icon: "💨", description: "Dust clouds from construction/traffic" },
  { value: "burning", label: "Burning", icon: "🔥", description: "Open fire or burning smell" },
  { value: "other", label: "Other", icon: "⚠️", description: "Other pollution type" },
];

function LocationPicker({ onSelect }: { onSelect: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function ReportPage() {
  const [step, setStep] = useState<"form" | "success" | "error">("form");
  const [category, setCategory] = useState("smoke");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = useCallback((file: File) => {
    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }, []);

  function getGPS() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setLocating(false);
        alert("Could not get GPS location. Please tap the map to set location.");
      },
      { timeout: 10000 }
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lat || !lon) { alert("Please set a location."); return; }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("lat", String(lat));
      form.append("lon", String(lon));
      form.append("category", category);
      form.append("description", description);
      if (photo) form.append("photo", photo);

      const res = await api.submitReport(form);
      setResult(res.report);
      setStep("success");
    } catch (e) {
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle size={32} className="text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Report Submitted!</h2>
          <p className="text-gray-400 text-sm">Your report has been received and classified.</p>
        </div>
        {result && (
          <div className="bg-gray-800 rounded-xl p-4 text-sm text-left w-full max-w-sm border border-gray-700">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-gray-400">Category</span><span className="text-white capitalize font-medium">{result.category}</span>
              <span className="text-gray-400">Severity</span><span className="text-white font-medium">{result.severity}/5</span>
              <span className="text-gray-400">Confidence</span><span className="text-white font-medium">{(result.confidence * 100).toFixed(0)}%</span>
              {result.description && <><span className="text-gray-400 col-span-2">Description</span><span className="text-gray-300 col-span-2 text-xs">{result.description}</span></>}
            </div>
          </div>
        )}
        <button
          onClick={() => { setStep("form"); setPhoto(null); setPhotoPreview(null); setDescription(""); setLat(null); setLon(null); }}
          className="px-6 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium text-sm transition-colors"
        >
          Submit Another Report
        </button>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <AlertCircle size={48} className="text-red-400" />
        <h2 className="text-xl font-bold text-white">Submission Failed</h2>
        <p className="text-gray-400 text-sm">Could not reach the server. Please try again.</p>
        <button onClick={() => setStep("form")} className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium text-sm">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-auto">
      <form onSubmit={submit} className="w-full max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Report Pollution</h1>
          <p className="text-gray-400 text-sm mt-1">No account needed. Takes under 30 seconds.</p>
        </div>

        {/* Category */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">What are you reporting?</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  category === c.value
                    ? "border-orange-500 bg-orange-500/10 text-white"
                    : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                }`}
              >
                <span className="text-xl">{c.icon}</span>
                <p className="font-medium text-sm mt-1">{c.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{c.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Photo upload */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">Photo (optional but helps AI classify)</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0])}
          />
          {photoPreview ? (
            <div className="relative inline-block">
              <img src={photoPreview} alt="preview" className="h-36 rounded-xl object-cover border border-gray-700" />
              <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-gray-900 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-600 hover:border-gray-500 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <Camera size={16} /> Tap to take/upload photo
            </button>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">Location</label>
          <button
            type="button"
            onClick={getGPS}
            disabled={locating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-sm font-medium transition-colors disabled:opacity-50 mb-2"
          >
            <MapPin size={14} />
            {locating ? "Getting location…" : lat ? `GPS: ${lat.toFixed(4)}, ${lon?.toFixed(4)}` : "Use my GPS location"}
          </button>
          <p className="text-xs text-gray-500 mb-2">Or tap the map to pin your location:</p>
          <div className="h-48 rounded-xl overflow-hidden border border-gray-700">
            <MapContainer center={[13.0827, 80.2707]} zoom={12} style={{ width: "100%", height: "100%" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LocationPicker onSelect={(la, lo) => { setLat(la); setLon(lo); }} />
              {lat && lon && <Marker position={[lat, lon]} />}
            </MapContainer>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">Description (optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What do you see/smell? Any additional context…"
            rows={3}
            className="w-full rounded-xl bg-gray-800 border border-gray-700 text-white text-sm p-3 placeholder:text-gray-500 focus:outline-none focus:border-orange-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={!lat || !lon || submitting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold text-sm transition-colors"
        >
          {submitting ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Classifying & Submitting…</>
          ) : (
            <><Send size={15} /> Submit Report</>
          )}
        </button>
      </form>
    </div>
  );
}
