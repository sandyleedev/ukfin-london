import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchDashboard } from "./api.js";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    setError(null);
    return fetchDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <DataContext.Provider value={{ data, error, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDashboard must be used within DataProvider");
  return ctx;
}
