import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Square, Loader2 } from "lucide-react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../../../Config/Firebase";
import ProcessingStep from "./Processing/ProcessingStep";

const processingSteps = [
  {
    id: 1,
    name: "Align Images",
    description: "Feature detection and camera alignment",
    duration: "~5 minutes",
  },
  {
    id: 2,
    name: "Dense Point Cloud",
    description: "Generate dense 3D point cloud",
    duration: "~15 minutes",
  },
  {
    id: 3,
    name: "Mesh Generation",
    description: "Create 3D mesh from point cloud",
    duration: "~10 minutes",
  },
  {
    id: 4,
    name: "Texturing",
    description: "Apply textures to 3D model",
    duration: "~8 minutes",
  },
];

type ProcessingLocationState = {
  projectId?: string;
  projectName?: string;
  imageCount?: number;
};

type ProjectPayload = {
  projectId?: string;
  name?: string;
  imageCount?: number;
  status?: string;
  progress?: number;
};

const getProcessingStepByProgress = (progress: number) => {
  if (progress >= 80) return 4;
  if (progress >= 55) return 3;
  if (progress >= 25) return 2;
  if (progress > 0) return 1;
  return 1;
};

const formatLogMessage = (message: string) => {
  const now = new Date();
  const timestamp = now.toLocaleTimeString("en-GB", { hour12: false });
  return `[${timestamp}] ${message}`;
};

function Processing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState("Preparing");
  const [projectDocId, setProjectDocId] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const processingTimerRef = useRef<number | null>(null);
  const hasNavigatedOnCompleteRef = useRef(false);
  const state = (location.state as ProcessingLocationState | null) ?? null;

  const activeProjectId = params.projectId || state?.projectId || "";
  const [projectName, setProjectName] = useState(state?.projectName?.trim() || activeProjectId || "New Project");
  const [imageCount, setImageCount] = useState(state?.imageCount ?? 0);

  const currentStep = useMemo(() => getProcessingStepByProgress(currentProgress), [currentProgress]);

  const clearProcessingTimer = useCallback(() => {
    if (processingTimerRef.current) {
      window.clearInterval(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  }, []);

  const appendLog = useCallback((message: string) => {
    setConsoleLogs((existingLogs) => {
      const nextLogs = [...existingLogs, formatLogMessage(message)];
      return nextLogs.slice(-120);
    });
  }, []);

  const appendRawLog = useCallback((message: string) => {
    setConsoleLogs((existingLogs) => {
      const nextLogs = [...existingLogs, message];
      return nextLogs.slice(-120);
    });
  }, []);

  const updateProjectDoc = useCallback(
    async (payload: Record<string, unknown>) => {
      const currentUser = auth.currentUser;
      if (!currentUser?.uid || !projectDocId) {
        return;
      }

      await updateDoc(doc(db, "Users", currentUser.uid, "Projects", projectDocId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    },
    [projectDocId]
  );

  useEffect(() => {
    const loadProjectAndMaybeStart = async () => {
      if (!activeProjectId) {
        setIsLoadingProject(false);
        return;
      }

      const currentUser = auth.currentUser;

      if (!currentUser?.uid) {
        setErrorMessage("You need to be signed in to process a project.");
        setIsLoadingProject(false);
        return;
      }

      setIsLoadingProject(true);

      try {
        const projectsRef = collection(db, "Users", currentUser.uid, "Projects");
        const projectQuery = query(projectsRef, where("projectId", "==", activeProjectId), limit(1));
        const projectSnapshot = await getDocs(projectQuery);

        if (projectSnapshot.empty) {
          throw new Error("Project not found.");
        }

        const firstDoc = projectSnapshot.docs[0];
        const projectData = firstDoc.data() as ProjectPayload;

        setProjectDocId(firstDoc.id);
        setProjectName(projectData.name?.trim() || state?.projectName?.trim() || activeProjectId);
        setImageCount(typeof projectData.imageCount === "number" ? projectData.imageCount : state?.imageCount ?? 0);

        const existingProgress =
          typeof projectData.progress === "number"
            ? projectData.progress
            : projectData.status?.trim().toLowerCase() === "processed"
            ? 100
            : 0;
        setCurrentProgress(existingProgress);

        const odmState = await window.electronAPI.getOdmTaskState(activeProjectId);

        if (odmState.logs.length > 0) {
          setConsoleLogs(odmState.logs.slice(-120));
        }

        if (odmState.status === "running") {
          setIsProcessing(true);
          setStatusLabel("Processing");
        } else if (odmState.status === "completed") {
          setIsProcessing(false);
          setStatusLabel("Completed");
          setCurrentProgress(100);
        } else if (odmState.status === "failed") {
          setIsProcessing(false);
          setStatusLabel("Failed");
        } else if (projectData.status?.trim().toLowerCase() !== "processed") {
          setIsProcessing(false);
          setStatusLabel("Waiting for ODMConsole");
          appendLog("Waiting for ODMConsole logs...");
        } else {
          setStatusLabel("Completed");
          setIsProcessing(false);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load project.";
        setErrorMessage(message);
        appendLog(message);
      } finally {
        setIsLoadingProject(false);
      }
    };

    void loadProjectAndMaybeStart();

    return () => {
      clearProcessingTimer();
    };
  }, [activeProjectId, appendLog, clearProcessingTimer, state?.imageCount, state?.projectName]);

  useEffect(() => {
    if (!activeProjectId) return;

    const unsubscribe = window.electronAPI.onMainMessage((data: unknown) => {
      if (!data || typeof data !== "object") {
        return;
      }

      const payload = data as {
        type?: string;
        projectId?: string;
        message?: string;
        status?: "idle" | "running" | "completed" | "failed";
        exitCode?: number | null;
      };

      if (payload.projectId !== activeProjectId) {
        return;
      }

      if (payload.type === "odm-log" && payload.message) {
        appendRawLog(payload.message);

        const percentageMatch = payload.message.match(/(\d{1,3})\s*%/);
        if (percentageMatch) {
          const value = Number.parseInt(percentageMatch[1], 10);
          if (Number.isFinite(value)) {
            setCurrentProgress(Math.min(100, Math.max(0, value)));
          }
        }
      }

      if (payload.type === "odm-status" && payload.status) {
        if (payload.status === "running") {
          setIsProcessing(true);
          setStatusLabel("Processing");
          return;
        }

        if (payload.status === "completed") {
          setIsProcessing(false);
          setStatusLabel("Completed");
          setCurrentProgress(100);
          appendLog("ODMConsole processing completed.");
          return;
        }

        if (payload.status === "failed") {
          setIsProcessing(false);
          setStatusLabel("Failed");
          appendLog(`ODMConsole failed (exit code: ${payload.exitCode ?? "unknown"}).`);
          return;
        }

        setIsProcessing(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeProjectId, appendLog, appendRawLog]);

  useEffect(() => {
    clearProcessingTimer();
  }, [clearProcessingTimer]);

  useEffect(() => {
    if (isLoadingProject || !projectDocId) {
      return;
    }

    const normalizedStatus = currentProgress >= 100 ? "Processed" : isProcessing ? "Processing" : "Paused";
    void updateProjectDoc({ status: normalizedStatus, progress: currentProgress });
  }, [currentProgress, isLoadingProject, isProcessing, projectDocId, updateProjectDoc]);

  useEffect(() => {
    if (currentProgress < 100 || hasNavigatedOnCompleteRef.current) {
      return;
    }

    hasNavigatedOnCompleteRef.current = true;
    clearProcessingTimer();
    setIsProcessing(false);
    setStatusLabel("Completed");
    appendLog("Processing completed.");
    navigate(`/viewer/${activeProjectId}`);
  }, [activeProjectId, appendLog, clearProcessingTimer, currentProgress, navigate]);

  const handlePauseResume = () => {
    if (isProcessing) {
      clearProcessingTimer();
      setIsProcessing(false);
      setStatusLabel("Paused");
      appendLog("Processing paused.");
      return;
    }

    if (currentProgress < 100) {
      setIsProcessing(true);
      setStatusLabel("Processing");
      appendLog("Processing resumed.");
    }
  };

  const handleStop = async () => {
    clearProcessingTimer();
    setIsProcessing(false);
    setStatusLabel("Stopped");
    appendLog("Processing stopped.");
    await updateProjectDoc({ status: "Failed" });
  };

  const displayProjectName = projectName.trim() || "New Project";
  const displayImageCount = imageCount;

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-6 border-b border-border">
        <h1 className="text-2xl mb-2">Processing: {displayProjectName}</h1>
        <p className="text-sm text-muted-foreground">
          Processing {displayImageCount} images • Step {currentStep} of 4 • {currentProgress}% complete
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Status: {statusLabel}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          {isLoadingProject && (
            <div className="bg-card border border-border rounded-lg p-4 mb-6 text-sm text-muted-foreground">
              Loading project configuration...
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-sm text-red-500">
              {errorMessage}
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-base mb-6">Processing Steps</h2>

            <div className="space-y-4">
              {processingSteps.map((step) => (
                <ProcessingStep
                  key={step.id}
                  step={step}
                  isActive={currentStep === step.id}
                  isComplete={currentStep > step.id}
                  progress={currentStep === step.id ? currentProgress : 0}
                />
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePauseResume}
                  className="w-10 h-10 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center justify-center transition-colors"
                >
                  {isProcessing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => {
                    void handleStop();
                  }}
                  className="w-10 h-10 bg-secondary hover:bg-accent border border-border rounded-lg flex items-center justify-center transition-colors"
                >
                  <Square className="w-4 h-4" />
                </button>
                <div className="ml-2">
                  <p className="text-sm">{isProcessing ? "Processing..." : statusLabel}</p>
                  <p className="text-xs text-muted-foreground">ODMConsole integration</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm mb-1">Overall Progress</p>
                <p className="text-2xl font-semibold text-primary">{currentProgress}%</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-base mb-4">Console Log</h2>

            <ScrollArea.Root className="h-64 rounded bg-[#0a0e14] border border-border">
              <ScrollArea.Viewport className="w-full h-full p-4">
                <div className="font-mono text-xs space-y-1">
                  {consoleLogs.map((log, index) => (
                    <div key={index} className="text-muted-foreground">
                      {log}
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="text-primary flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Processing images...
                    </div>
                  )}
                </div>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar
                className="flex select-none touch-none p-0.5 bg-transparent transition-colors duration-150 ease-out hover:bg-accent data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5"
                orientation="vertical"
              >
                <ScrollArea.Thumb className="relative flex-1 rounded-full bg-border before:absolute before:top-1/2 before:left-1/2 before:h-full before:min-h-11 before:w-full before:min-w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']" />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Processing;
