import { useEffect, useMemo, useState } from "react";
import { matchRoute, navigate, useRoute } from "./router";
import Home from "./pages/Home";
import PropertyList from "./pages/PropertyList";
import PropertyForm from "./pages/PropertyForm";
import PropertyDetail from "./pages/PropertyDetail";
import AssessmentForm from "./pages/AssessmentForm";
import EstimateProposal from "./pages/EstimateProposal";
import DataTools from "./pages/Data";
import { ToastProvider } from "./components/Toast";
import { loadActiveZones, saveActiveZones } from "./utils/activeZones";
import { processPhotoUploadQueue, processSyncQueue, syncFromSupabase } from "./db/api";

function detectEnvironment() {
  if (typeof window === "undefined") {
    return { label: "UNKNOWN", kind: "preview", host: "" };
  }
  const { hostname, host, port } = window.location;
  const isLocalHost =
    import.meta.env.DEV ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
    Boolean(port);
  if (isLocalHost) {
    return { label: "LOCAL DEV", kind: "dev", host };
  }
  if (hostname === "app.bhfos.com") {
    return { label: "LIVE", kind: "live", host };
  }
  return { label: "PREVIEW", kind: "preview", host };
}

export default function App() {
  const route = useRoute();
  const { path } = route;
  const [activeZones, setActiveZones] = useState(loadActiveZones());
  const environment = useMemo(() => detectEnvironment(), []);

  useEffect(() => {
    saveActiveZones(activeZones);
  }, [activeZones]);

  useEffect(() => {
    const syncAll = async () => {
      try {
        await processSyncQueue();
      } catch (error) {
        console.warn("Record sync queue skipped", error);
      }
      try {
        await processPhotoUploadQueue();
      } catch (error) {
        console.warn("Photo upload queue skipped", error);
      }
      try {
        await syncFromSupabase();
      } catch (error) {
        console.warn("Supabase sync skipped", error);
      }
    };

    syncAll();
    const handleOnline = () => {
      syncAll();
    };
    window.addEventListener("online", handleOnline);
    const interval = setInterval(() => {
      syncAll();
    }, 30000);
    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, []);

  let content = null;

  if (path === "/" || path === "/home") {
    content = <Home activeZones={activeZones} setActiveZones={setActiveZones} />;
  } else if (path === "/properties") {
    content = <PropertyList activeZones={activeZones} setActiveZones={setActiveZones} />;
  } else if (path === "/data") {
    content = <DataTools />;
  } else if (path === "/properties/new") {
    content = <PropertyForm />;
  } else {
    const propertyMatch = matchRoute("/properties/:id", path);
    const propertyEditMatch = matchRoute("/properties/:id/edit", path);
    const assessmentMatch = matchRoute("/assessments/:id", path);
    const estimateMatch = matchRoute("/assessments/:id/estimate", path);

    if (propertyEditMatch) {
      content = <PropertyForm propertyId={propertyEditMatch.id} />;
    } else if (propertyMatch) {
      content = <PropertyDetail propertyId={propertyMatch.id} activeZones={activeZones} />;
    } else if (estimateMatch) {
      content = <EstimateProposal assessmentId={estimateMatch.id} />;
    } else if (assessmentMatch) {
      content = <AssessmentForm assessmentId={assessmentMatch.id} />;
    } else {
      content = (
        <div className="page">
          <div className="empty-state">Page not found.</div>
          <button className="primary" type="button" onClick={() => navigate("/")}>Go Home</button>
        </div>
      );
    }
  }

  return (
    <ToastProvider>
      <div className="app">
        <header className="app-header">
          <button className="app-home" type="button" onClick={() => navigate("/")}>
            <div className="app-title">TIS Scout</div>
            <div className="app-subtitle">Field Intelligence Capture</div>
          </button>
          <div className="app-header-meta">
            <div className={`env-badge ${environment.kind}`}>{environment.label}</div>
            <div className="host-label">Host: {environment.host || "unknown"}</div>
            <div className="route-label">Route: {path}</div>
          </div>
        </header>
        <main className="app-main">{content}</main>
      </div>
    </ToastProvider>
  );
}
