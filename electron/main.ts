import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as fs from "fs";
import os from "os";
import { promisify } from "node:util";
import http from "node:http";

// ==============================
// 📁 ESM __dirname FIX
// ==============================
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==============================
// 🧠 App Configuration
// ==============================
app.setPath("userData", path.join(app.getPath("appData"), "DroneMeshPro"));

app.commandLine.appendSwitch("disable-features", "AutofillServerCommunication");
app.commandLine.appendSwitch("disable-blink-features", "ResizeObserver");

// ==============================
// 📦 Paths
// ==============================
process.env.APP_ROOT = path.join(__dirname, "..");

export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// ==============================
// 🪟 Window Reference
// ==============================
let win: BrowserWindow | null = null;
let systemStatsTimer: NodeJS.Timeout | null = null;

type SystemStats = {
  cpuUsage: number;
  gpuUsage: number;
  storageUsedGB: number;
  storageTotalGB: number;
  storagePercent: number;
  storageLabel: string;
};

type SelectedImage = {
  path: string;
  name: string;
  size: number;
};

type CreateProjectPayload = {
  projectId: string;
  projectName: string;
  projectLocation: string;
  description: string;
  images: SelectedImage[];
};

type OdmTaskStatus = "idle" | "running" | "completed" | "failed";

type OdmTaskState = {
  logs: string[];
  status: OdmTaskStatus;
  startedAt?: number;
  endedAt?: number;
  exitCode?: number | null;
};

type ExternalGoogleAuthResult = {
  idToken: string;
  accessToken?: string;
};

const GOOGLE_AUTH_CALLBACK_PORT = 6000;
const GOOGLE_AUTH_CALLBACK_HOST = "localhost";

const emptySystemStats: SystemStats = {
  cpuUsage: 0,
  gpuUsage: 0,
  storageUsedGB: 0,
  storageTotalGB: 0,
  storagePercent: 0,
  storageLabel: "C: drive",
};

let latestSystemStats: SystemStats = emptySystemStats;

const odmProcesses = new Map<string, ChildProcess>();
const odmTaskStates = new Map<string, OdmTaskState>();
const ODM_LOG_LIMIT = 400;

const execFileAsync = promisify(execFile);

function getOrCreateOdmTaskState(projectId: string) {
  const existingState = odmTaskStates.get(projectId);
  if (existingState) return existingState;

  const nextState: OdmTaskState = { logs: [], status: "idle" };
  odmTaskStates.set(projectId, nextState);
  return nextState;
}

function pushOdmLog(projectId: string, message: string) {
  const state = getOrCreateOdmTaskState(projectId);
  state.logs.push(message);

  if (state.logs.length > ODM_LOG_LIMIT) {
    state.logs = state.logs.slice(-ODM_LOG_LIMIT);
  }

  win?.webContents.send("main-process-message", {
    type: "odm-log",
    projectId,
    message,
  });
}

function updateOdmStatus(projectId: string, status: OdmTaskStatus, exitCode?: number | null) {
  const state = getOrCreateOdmTaskState(projectId);
  state.status = status;

  if (status === "running") {
    state.startedAt = Date.now();
    state.endedAt = undefined;
    state.exitCode = undefined;
  }

  if (status === "completed" || status === "failed") {
    state.endedAt = Date.now();
    state.exitCode = exitCode;
  }

  win?.webContents.send("main-process-message", {
    type: "odm-status",
    projectId,
    status,
    exitCode,
  });
}

function resolveExistingPath(candidatePath: string | undefined) {
  if (!candidatePath) return null;

  const trimmedPath = candidatePath.trim();
  if (!trimmedPath) return null;

  return fs.existsSync(trimmedPath) ? trimmedPath : null;
}

async function resolveOdmConsoleCommand() {
  const explicitPath =
    resolveExistingPath(process.env.ODM_CONSOLE_COMMAND) ||
    resolveExistingPath(process.env.ODM_CONSOLE_PATH);

  if (explicitPath) {
    return explicitPath;
  }

  if (process.platform === "win32") {
    const likelyInstallPaths = [
      path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs", "ODM", "ODM Console.exe"),
      path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs", "ODM", "ODMConsole.exe"),
      path.join("C:\\", "Program Files", "ODMConsole", "ODMConsole.exe"),
      path.join("C:\\", "Program Files (x86)", "ODMConsole", "ODMConsole.exe"),
      path.join("C:\\", "ODMConsole", "ODMConsole.exe"),
    ];

    for (const installPath of likelyInstallPaths) {
      if (fs.existsSync(installPath)) {
        return installPath;
      }
    }

    const whereCandidates = ["ODMConsole.exe", "ODMConsole.cmd", "ODMConsole.bat", "ODMConsole","ODM Console.exe"];
    for (const binaryName of whereCandidates) {
      try {
        const { stdout } = await execFileAsync("where.exe", [binaryName]);
        const firstMatch = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean);

        if (firstMatch && fs.existsSync(firstMatch)) {
          return firstMatch;
        }
      } catch {
        // Try next candidate.
      }
    }
  }

  return null;
}

async function startOdmConsole(projectId: string, projectPath: string) {
  const existingProcess = odmProcesses.get(projectId);
  if (existingProcess && !existingProcess.killed) {
    return;
  }

  const odmCommand = await resolveOdmConsoleCommand();
  if (!odmCommand) {
    pushOdmLog(projectId, "ODMConsole executable was not found.");
    pushOdmLog(
      projectId,
      "Set ODM_CONSOLE_COMMAND or ODM_CONSOLE_PATH to the full ODMConsole executable path."
    );
    updateOdmStatus(projectId, "failed", null);
    return;
  }

  const commandLine = `"${odmCommand}" run "${projectPath}"`;
  const childProcess = spawn(odmCommand, ["run", projectPath], {
    cwd: path.dirname(odmCommand),
    windowsHide: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  odmProcesses.set(projectId, childProcess);
  pushOdmLog(projectId, `$ ${commandLine}`);
  updateOdmStatus(projectId, "running");

  childProcess.stdout.on("data", (chunk: Buffer) => {
    const lines = chunk
      .toString()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      pushOdmLog(projectId, line);
    }
  });

  childProcess.stderr.on("data", (chunk: Buffer) => {
    const lines = chunk
      .toString()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      pushOdmLog(projectId, `[stderr] ${line}`);
    }
  });

  childProcess.on("error", (error) => {
    pushOdmLog(projectId, `Failed to start ODMConsole: ${error.message}`);
    updateOdmStatus(projectId, "failed", null);
    odmProcesses.delete(projectId);
  });

  childProcess.on("close", (code) => {
    pushOdmLog(projectId, `ODMConsole exited with code ${code ?? "unknown"}`);
    updateOdmStatus(projectId, code === 0 ? "completed" : "failed", code);
    odmProcesses.delete(projectId);
  });
}

function getStorageUsage(): Pick<
  SystemStats,
  "storageUsedGB" | "storageTotalGB" | "storagePercent" | "storageLabel"
> {
  const rootPath = path.parse(os.homedir()).root || "C:\\";
  const stats = fs.statfsSync(rootPath);
  const blockSize = Number(stats.bsize || (stats as fs.StatsFs & { frsize?: number }).frsize || 0);
  const totalBytes = blockSize * Number(stats.blocks || 0);
  const availableBytes = blockSize * Number(stats.bavail || 0);
  const usedBytes = Math.max(totalBytes - availableBytes, 0);
  const percent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  return {
    storageUsedGB: usedBytes / 1024 ** 3,
    storageTotalGB: totalBytes / 1024 ** 3,
    storagePercent: percent,
    storageLabel: `${rootPath.replace(/\\$/, "")} drive`,
  };
}

async function getCpuUsage(): Promise<number> {
  const sample = () =>
    os.cpus().map((cpu) => {
      const times = cpu.times;
      const total = times.user + times.nice + times.sys + times.idle + times.irq;
      return { idle: times.idle, total };
    });

  const start = sample();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const end = sample();

  const totalDelta = end.reduce((sum, cpu, index) => sum + (cpu.total - start[index].total), 0);
  const idleDelta = end.reduce((sum, cpu, index) => sum + (cpu.idle - start[index].idle), 0);

  return totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0;
}

async function getGpuUsage(): Promise<number> {
  if (process.platform !== "win32") return 0;

  const script = [
    "$gpu = $null",
    "try {",
    "  $samples = (Get-Counter '\\GPU Engine(*)\\Utilization Percentage' -ErrorAction Stop).CounterSamples | Where-Object { $_.CookedValue -gt 0 }",
    "  if ($samples) {",
    "    $gpu = [math]::Round((($samples | Measure-Object CookedValue -Average).Average), 0)",
    "  }",
    "} catch {}",
    "if ($null -eq $gpu) {",
    "  try {",
    "    $controller = Get-CimInstance Win32_VideoController | Select-Object -First 1",
    "    if ($null -ne $controller.LoadPercentage) {",
    "      $gpu = [int]$controller.LoadPercentage",
    "    }",
    "  } catch {}",
    "}",
    "if ($null -eq $gpu) { $gpu = 0 }",
    "[int]$gpu",
  ].join("; ");

  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script]);
    const parsed = Number.parseInt(stdout.trim(), 10);
    return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
  } catch {
    return 0;
  }
}

async function refreshSystemStats() {
  const [storageUsage, gpuUsage, cpuUsage] = await Promise.all([
    Promise.resolve(getStorageUsage()),
    getGpuUsage(),
    getCpuUsage(),
  ]);

  latestSystemStats = {
    cpuUsage: Math.min(100, Math.max(0, cpuUsage)),
    gpuUsage,
    ...storageUsage,
  };
}

function startSystemStatsPolling() {
  void refreshSystemStats();
  systemStatsTimer = setInterval(() => {
    void refreshSystemStats();
  }, 3000);
}

function sanitizeFolderName(folderName: string) {
  const cleanedName = folderName
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\.+$/g, "")
    .replace(/\s+/g, " ");
  return cleanedName || "New Project";
}

async function getUniqueFilePath(filePath: string) {
  const parsedPath = path.parse(filePath);
  let candidatePath = filePath;
  let counter = 1;
  while (fs.existsSync(candidatePath)) {
    candidatePath = path.join(parsedPath.dir, `${parsedPath.name}-${counter}${parsedPath.ext}`);
    counter += 1;
  }
  return candidatePath;
}

async function createGoogleAuthUri(apiKey: string, continueUri: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: "google.com",
        continueUri,
      }),
    }
  );

  if (!response.ok) throw new Error("Failed to initialize Google sign-in.");
  const payload = (await response.json()) as { authUri?: string };
  if (!payload.authUri) throw new Error("Google sign-in URL was not returned.");
  return payload.authUri;
}

async function signInWithGoogleInBrowser(apiKey: string): Promise<ExternalGoogleAuthResult> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (request, response) => {
      try {
        const urlObj = new URL(
          request.url || "/",
          `http://${GOOGLE_AUTH_CALLBACK_HOST}:${GOOGLE_AUTH_CALLBACK_PORT}`
        );

        console.log("[google-auth] callback request:", urlObj.pathname, urlObj.search || "<no query>");

        if (urlObj.pathname !== "/auth/google/callback") {
          console.warn("[google-auth] unexpected callback path:", urlObj.pathname);
          response.statusCode = 404;
          response.end("Not found");
          return;
        }

        if (!urlObj.search) {
          console.log("[google-auth] callback received without query yet; waiting for fragment handoff.");
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h3>Finalizing Authentication...</h3>
                <script>
                  if (window.location.hash) {
                    const query = window.location.hash.replace(/^#/, '');
                    window.location.replace('/auth/google/callback?' + query);
                  } else {
                    document.body.innerHTML = "<h3>Finishing sign-in...</h3>";
                    setTimeout(() => window.close(), 250);
                  }
                </script>
              </body>
            </html>
          `);
          return;
        }

        const idToken = urlObj.searchParams.get("id_token") || urlObj.searchParams.get("oauthIdToken");
        const accessToken = urlObj.searchParams.get("access_token") || urlObj.searchParams.get("oauthAccessToken") || undefined;

        console.log("[google-auth] callback query keys:", Array.from(urlObj.searchParams.keys()).join(", ") || "<none>");

        if (idToken) {
          console.log("[google-auth] id token received successfully.");
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h3>Google sign-in complete. You can close this tab.</h3>
                <script>
                  setTimeout(() => window.close(), 250);
                </script>
              </body>
            </html>
          `);
          cleanup();
          resolve({ idToken, accessToken });
        } else {
          const error = urlObj.searchParams.get("error") || "Unknown error";
          console.error("[google-auth] callback did not include id_token:", error);
          response.statusCode = 400;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h3>Google sign-in failed</h3>
                <p>${error}</p>
                <p>You can close this tab and return to the app.</p>
              </body>
            </html>
          `);
          cleanup();
          reject(new Error(error));
        }
      } catch (error) {
        console.error("[google-auth] callback handler error:", error);
        cleanup();
        reject(error);
      }
    });

    let timeout: NodeJS.Timeout | null = null;
    const cleanup = () => {
      if (timeout) { clearTimeout(timeout); timeout = null; }
      server.close();
    };

    server.listen(GOOGLE_AUTH_CALLBACK_PORT, async () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        cleanup();
        reject(new Error("Failed to start Google sign-in callback server."));
        return;
      }

      const continueUri = `http://${GOOGLE_AUTH_CALLBACK_HOST}:${GOOGLE_AUTH_CALLBACK_PORT}/auth/google/callback`;

      console.log("[google-auth] callback server listening at:", continueUri);

      try {
        const authUri = await createGoogleAuthUri(apiKey, continueUri);
        console.log("[google-auth] opening external browser auth URI.");
        await shell.openExternal(authUri);
      } catch (error) {
        console.error("[google-auth] failed to create/open auth URI:", error);
        cleanup();
        reject(error);
        return;
      }

      timeout = setTimeout(() => {
        console.error("[google-auth] timed out waiting for callback on port", GOOGLE_AUTH_CALLBACK_PORT);
        cleanup();
        reject(
          new Error(
            "Google sign-in timed out. No callback reached the app. Check that localhost:6000 is not blocked and keep the browser sign-in tab open until completion."
          )
        );
      }, 180000);
    });

    server.on("error", (error) => {
      console.error("[google-auth] callback server error:", error);
      cleanup();
      reject(error);
    });
  });
}

// ==============================
// 🪟 Create Window
// ==============================
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    show: false,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  win.once("ready-to-show", () => {
    win?.show();
  });
}

// ==============================
// 🔁 App Lifecycle
// ==============================
app.whenReady().then(async () => {
  await refreshSystemStats();
  startSystemStatsPolling();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (systemStatsTimer) clearInterval(systemStatsTimer);
    app.quit();
  }
});

// ==============================
// 🪟 Window Controls & IPC
// ==============================
ipcMain.on("window-minimize", () => win?.minimize());
ipcMain.on("window-maximize", () => {
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on("window-close", () => win?.close());
ipcMain.handle("get-system-stats", async () => latestSystemStats);

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("select-images", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "tif", "tiff", "bmp", "webp"] }],
  });
  if (result.canceled) return [];
  return Promise.all(
    result.filePaths.map(async (filePath) => {
      const stats = await fs.promises.stat(filePath);
      return { path: filePath, name: path.basename(filePath), size: stats.size };
    })
  );
});

ipcMain.handle("create-project", async (_event, payload: CreateProjectPayload) => {
  const projectRoot = path.join(payload.projectLocation, sanitizeFolderName(payload.projectName));
  const imagesFolder = path.join(projectRoot, "images");
  await fs.promises.mkdir(imagesFolder, { recursive: true });
  await fs.promises.writeFile(path.join(projectRoot, "description.txt"), payload.description || "");
  for (const image of payload.images) {
    await fs.promises.copyFile(image.path, await getUniqueFilePath(path.join(imagesFolder, image.name)));
  }

  void startOdmConsole(payload.projectId, projectRoot);
  return { projectPath: projectRoot };
});

ipcMain.handle("read-directory", async (_event, dirPath: string) => {
  try {
    const files = await fs.promises.readdir(dirPath);
    const detailedFiles = await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(dirPath, file);
        const stats = await fs.promises.stat(fullPath);
        return { name: file, path: fullPath, isDirectory: stats.isDirectory(), size: stats.size, type: stats.isDirectory() ? "folder" : path.extname(file).toLowerCase() };
      })
    );
    const allowed = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".obj", ".ply"];
    return detailedFiles.filter(f => f.isDirectory || allowed.includes(f.type));
  } catch (err: any) { return { error: err.message }; }
});

ipcMain.handle("open-explorer", async (_event, folderPath: string) => {
  if (folderPath) shell.openPath(folderPath);
});

ipcMain.handle("trash-project-folder", async (_event, folderPath: string) => {
  if (!folderPath || typeof folderPath !== "string") {
    throw new Error("A valid project folder path is required.");
  }

  const normalizedPath = path.normalize(folderPath);

  if (!fs.existsSync(normalizedPath)) {
    return { movedToTrash: false, reason: "not-found" as const };
  }

  await shell.trashItem(normalizedPath);
  return { movedToTrash: true };
});

ipcMain.handle("get-odm-task-state", async (_event, projectId: string) => {
  if (!projectId || typeof projectId !== "string") {
    return { status: "idle" as const, logs: [] as string[] };
  }

  const state = odmTaskStates.get(projectId);
  if (!state) {
    return { status: "idle" as const, logs: [] as string[] };
  }

  return {
    status: state.status,
    logs: [...state.logs],
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    exitCode: state.exitCode,
  };
});

ipcMain.handle("sign-in-google-external", async () => {
  const apiKey = "AIzaSyBtOBq3HC-4AiDqPdCFprfxx1IzXgSVDQo"; // Consider moving this to an env variable
  return signInWithGoogleInBrowser(apiKey);
});