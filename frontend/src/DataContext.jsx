import { createContext, useContext, useEffect, useState } from "react";
import { fetchDashboard } from "./api.js";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <DataContext.Provider value={{ data, error }}>
      {children}
    </DataContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDashboard must be used within DataProvider");
  return ctx;
}
