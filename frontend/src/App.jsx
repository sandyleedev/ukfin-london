import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { DataProvider } from "./DataContext.jsx";
import Layout from "./components/Layout.jsx";
import LandingPage from "./components/LandingPage.jsx";
import Overview from "./pages/Overview.jsx";
import Clusters from "./pages/Clusters.jsx";
import Cases from "./pages/Cases.jsx";
import Scoring from "./pages/Scoring.jsx";

function Landing() {
  const navigate = useNavigate();
  return <LandingPage onLaunch={() => navigate("/overview")} />;
}

export default function App() {
  return (
    <DataProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<Layout />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/clusters" element={<Clusters />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/scoring" element={<Scoring />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DataProvider>
  );
}
