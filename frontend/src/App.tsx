import { Routes, Route, NavLink } from "react-router-dom";
import { MapPin, LayoutDashboard, AlertTriangle, Wind, BarChart3 } from "lucide-react";
import PublicMap from "./pages/PublicMap";
import MunicipalDashboard from "./pages/MunicipalDashboard";
import ReportPage from "./pages/ReportPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import DemoController from "./components/DemoController";
import clsx from "clsx";

export default function App() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0 z-50">
        <div className="flex items-center gap-2">
          <Wind className="text-orange-400" size={22} />
          <span className="font-bold text-white text-lg tracking-tight">PollutionWatch</span>
          <span className="text-xs text-gray-500 hidden sm:inline">Neighbourhood Hotspot Detection</span>
        </div>
        <nav className="ml-auto flex gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-orange-500/20 text-orange-300" : "text-gray-400 hover:text-white hover:bg-gray-800")
            }
          >
            <MapPin size={15} /> Public Map
          </NavLink>
          <NavLink
            to="/report"
            className={({ isActive }) =>
              clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-orange-500/20 text-orange-300" : "text-gray-400 hover:text-white hover:bg-gray-800")
            }
          >
            <AlertTriangle size={15} /> Report
          </NavLink>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-orange-500/20 text-orange-300" : "text-gray-400 hover:text-white hover:bg-gray-800")
            }
          >
            <LayoutDashboard size={15} /> Municipal Dashboard
          </NavLink>
          <NavLink
            to="/analytics"
            className={({ isActive }) =>
              clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-orange-500/20 text-orange-300" : "text-gray-400 hover:text-white hover:bg-gray-800")
            }
          >
            <BarChart3 size={15} /> Analytics
          </NavLink>
        </nav>
      </header>

      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<PublicMap />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/dashboard" element={<MunicipalDashboard />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </main>

      <DemoController onScenarioTriggered={() => window.dispatchEvent(new Event("refresh-map-data"))} />
    </div>
  );
}

