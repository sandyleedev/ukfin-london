import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { DataProvider } from "./DataContext.jsx";
import { AudienceProvider } from "./AudienceContext.jsx";
import Layout from "./components/Layout.jsx";
import LandingHost from "./components/landings/LandingHost.jsx";
import Overview from "./pages/Overview.jsx";
import Clusters from "./pages/Clusters.jsx";
import Cases from "./pages/Cases.jsx";
import Scoring from "./pages/Scoring.jsx";
import Outbox from "./pages/Outbox.jsx";

function Landing() {
  const navigate = useNavigate();
  return <LandingHost onLaunch={() => navigate("/overview")} />;
}

export default function App() {
  return (
    <DataProvider>
      <AudienceProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<Layout />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/clusters" element={<Clusters />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/scoring" element={<Scoring />} />
          <Route path="/outbox" element={<Outbox />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AudienceProvider>
    </DataProvider>
  );
}
