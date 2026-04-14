import { ipcRenderer, contextBridge } from "electron";

// ==============================
// 🌉 Electron API (SAFE BRIDGE)
// ==============================

const electronAPI = {
  // ==============================
  // 📁 FILE SYSTEM
  // ==============================

  readDirectory: (dirPath: string) => {
    return ipcRenderer.invoke("read-directory", dirPath);
  },

  selectFolder: () => {
    return ipcRenderer.invoke("select-folder");
  },

  selectImages: () => {
    return ipcRenderer.invoke("select-images");
  },

  createProject: (payload: {
    projectId: string;
    projectName: string;
    projectLocation: string;
    description: string;
    images: Array<{ path: string; name: string; size: number }>;
  }) => {
    return ipcRenderer.invoke("create-project", payload);
  },

  getSystemStats: () => {
    return ipcRenderer.invoke("get-system-stats");
  },

  // ==============================
  // 🪟 WINDOW CONTROLS
  // ==============================

  minimize: () => {
    ipcRenderer.send("window-minimize");
  },

  maximize: () => {
    ipcRenderer.send("window-maximize");
  },

  close: () => {
    ipcRenderer.send("window-close");
  },

  // ==============================
  // 🪟 NATIVE EXPLORER
  // ==============================

  openExplorer: (folderPath: string) => {
    return ipcRenderer.invoke("open-explorer", folderPath);
  },

  trashProjectFolder: (folderPath: string) => {
    return ipcRenderer.invoke("trash-project-folder", folderPath);
  },

  getOdmTaskState: (projectId: string) => {
    return ipcRenderer.invoke("get-odm-task-state", projectId);
  },

  signInWithGoogleExternal: () => {
    return ipcRenderer.invoke("sign-in-google-external");
  },

  // ==============================
  // 📡 MAIN PROCESS EVENTS
  // ==============================

  onMainMessage: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);

    ipcRenderer.on("main-process-message", listener);

    // cleanup function (VERY IMPORTANT)
    return () => {
      ipcRenderer.removeListener("main-process-message", listener);
    };
  },
};

// ==============================
// 🔐 EXPOSE TO RENDERER
// ==============================

contextBridge.exposeInMainWorld("electronAPI", electronAPI);