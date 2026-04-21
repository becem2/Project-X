import { useEffect, useState } from "react";

// Snapshot of the stats consumed by the status bar.
export type SystemStats = {
  cpuUsage: number;
  gpuUsage: number;
  ramUsedGB: number;
  ramTotalGB: number;
  ramPercent: number;
  storageUsedGB: number;
  storageTotalGB: number;
  storagePercent: number;
  storageLabel: string;
};

const defaultStats: SystemStats = {
  cpuUsage: 0,
  gpuUsage: 0,
  ramUsedGB: 0,
  ramTotalGB: 0,
  ramPercent: 0,
  storageUsedGB: 0,
  storageTotalGB: 0,
  storagePercent: 0,
  storageLabel: "C: drive",
};

export function useSystemMetrics(pollInterval = 3000) {
  // Poll the Electron main process for the latest CPU, GPU, and storage data.
  const [stats, setStats] = useState<SystemStats>(defaultStats);

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      const nextStats = await window.electronAPI?.getSystemStats?.();

      if (active && nextStats) {
        setStats((previous) => {
          if (
            previous.cpuUsage === nextStats.cpuUsage &&
            previous.gpuUsage === nextStats.gpuUsage &&
            previous.ramUsedGB === nextStats.ramUsedGB &&
            previous.ramTotalGB === nextStats.ramTotalGB &&
            previous.ramPercent === nextStats.ramPercent &&
            previous.storageUsedGB === nextStats.storageUsedGB &&
            previous.storageTotalGB === nextStats.storageTotalGB &&
            previous.storagePercent === nextStats.storagePercent &&
            previous.storageLabel === nextStats.storageLabel
          ) {
            return previous;
          }

          return nextStats;
        });
      }
    };

    void loadStats();
    const timer = window.setInterval(() => {
      void loadStats();
    }, pollInterval);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pollInterval]);

  return stats;
}