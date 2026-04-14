import { useEffect, useState } from "react";

export type SystemStats = {
  cpuUsage: number;
  gpuUsage: number;
  storageUsedGB: number;
  storageTotalGB: number;
  storagePercent: number;
  storageLabel: string;
};

const defaultStats: SystemStats = {
  cpuUsage: 0,
  gpuUsage: 0,
  storageUsedGB: 0,
  storageTotalGB: 0,
  storagePercent: 0,
  storageLabel: "C: drive",
};

export function useSystemMetrics(pollInterval = 3000) {
  const [stats, setStats] = useState<SystemStats>(defaultStats);

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      const nextStats = await window.electronAPI?.getSystemStats?.();

      if (active && nextStats) {
        setStats(nextStats);
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