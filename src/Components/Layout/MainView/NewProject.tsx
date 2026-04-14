import { useEffect, useState } from "react";
import { FolderOpen, Upload, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { deleteDoc, doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../../Config/Firebase";
import ToggleOption from "./NewProject/ToggleOption";

type SelectedImage = {
  path: string;
  name: string;
  size: number;
};

const generateProjectId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const toProjectNameKey = (name: string) =>
  encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, " "));

function NewProject() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [defaultProjectLocation, setDefaultProjectLocation] = useState("");
  const [description, setDescription] = useState("");
  const [generate3D, setGenerate3D] = useState(false);
  const [generateOrtho, setGenerateOrtho] = useState(false);
  const [generateNDVI, setGenerateNDVI] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createNudgeKey, setCreateNudgeKey] = useState(0);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [pathInvalid, setPathInvalid] = useState(false);

  const selectedImageCount = selectedImages.length;
  const selectedImageSize = selectedImages.reduce((total, image) => total + image.size, 0);
  const hasAtLeastOneOption = generate3D || generateOrtho || generateNDVI;
  const resolvedProjectLocation = projectPath.trim() || defaultProjectLocation.trim();
  const isProjectNameValid = projectName.trim().length > 0;
  const isProjectPathValid = resolvedProjectLocation.length > 0;
  const isDescriptionValid = description.trim().length > 0;
  const hasEnoughImages = selectedImageCount >= 5;
  const isCreateFormValid =
    isProjectNameValid &&
    isProjectPathValid &&
    isDescriptionValid &&
    hasEnoughImages &&
    hasAtLeastOneOption;
  const shouldShowCreateErrorAnimation =
    (validationAttempted && !isCreateFormValid) || pathInvalid;

  useEffect(() => {
    const loadDefaultProjectLocation = async () => {
      const currentUser = auth.currentUser;

      if (!currentUser?.uid) {
        setDefaultProjectLocation("");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "Users", currentUser.uid));
        const userData = userDoc.data() as { defaultProjectLocation?: string } | undefined;
        setDefaultProjectLocation(userData?.defaultProjectLocation?.trim() || "");
      } catch (error) {
        console.error("Failed to load default project location", error);
        setDefaultProjectLocation("");
      }
    };

    void loadDefaultProjectLocation();
  }, []);

  const formatFileSize = (sizeInBytes: number) => {
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    if (sizeInBytes < 1024 ** 2) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    if (sizeInBytes < 1024 ** 3) return `${(sizeInBytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(sizeInBytes / 1024 ** 3).toFixed(2)} GB`;
  };

  const mergeSelectedImages = (images: SelectedImage[]) => {
    setSelectedImages((currentImages) => {
      const imageMap = new Map(currentImages.map((image) => [image.path, image]));

      for (const image of images) {
        imageMap.set(image.path, image);
      }

      return Array.from(imageMap.values());
    });
  };

  const isImageFile = (fileName: string) =>
    /\.(jpg|jpeg|png|tif|tiff|bmp|webp)$/i.test(fileName);

  const collectDroppedImages = (files: FileList) => {
    return Array.from(files)
      .filter((file) => isImageFile(file.name))
      .map((file) => {
        const fileWithPath = file as File & { path?: string };

        return {
          path: fileWithPath.path ?? file.name,
          name: file.name,
          size: file.size,
        } satisfies SelectedImage;
      });
  };

  const handleCreateProject = async () => {
    setValidationAttempted(true);
    setPathInvalid(false);

    if (!isCreateFormValid) {
      setCreateNudgeKey((currentKey) => currentKey + 1);
      return;
    }

    let reservedProjectDocRef: ReturnType<typeof doc> | null = null;

    try {
      setIsCreating(true);

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("You must be logged in to create a project.");
      }

      const cleanedProjectName = projectName.trim();
      const projectId = generateProjectId();
      const projectNameKey = toProjectNameKey(cleanedProjectName);
      const projectDocRef = doc(db, "Users", currentUser.uid, "Projects", projectNameKey);

      await runTransaction(db, async (transaction) => {
        const existingProjectWithSameName = await transaction.get(projectDocRef);

        if (existingProjectWithSameName.exists()) {
          throw new Error("A project with this name already exists in your account.");
        }

        transaction.set(projectDocRef, {
          projectId,
          uid: currentUser.uid,
          nameKey: projectNameKey,
          name: cleanedProjectName,
          description: description.trim(),
          imageCount: selectedImageCount,
          totalImageSizeBytes: selectedImageSize,
          projectPath: "",
          basePath: resolvedProjectLocation,
          status: "Not Started",
          processingOptions: {
            generate3D,
            generateOrtho,
            generateNDVI,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      reservedProjectDocRef = projectDocRef;

      const result = await window.electronAPI.createProject({
        projectId,
        projectName: cleanedProjectName,
        projectLocation: resolvedProjectLocation,
        description,
        images: selectedImages,
      });

      await setDoc(projectDocRef, {
        projectPath: result.projectPath,
        progress: 0,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      reservedProjectDocRef = null;

      await window.electronAPI.openExplorer(result.projectPath);
      navigate(`/processing/${projectId}`, {
        state: {
          projectId,
          projectName: cleanedProjectName,
          imageCount: selectedImageCount,
        },
      });
    } catch (error) {
      if (reservedProjectDocRef) {
        try {
          await deleteDoc(reservedProjectDocRef);
        } catch {
          // best effort cleanup when local project creation fails after reservation
        }
      }

      console.error("Failed to create project", error);
      const invalidPathError =
        error instanceof Error && /project location|existing folder|not found/i.test(error.message);
      setPathInvalid(invalidPathError);
      setCreateNudgeKey((currentKey) => currentKey + 1);
    } finally {
      setIsCreating(false);
    }
  };

  const handleBrowseProjectLocation = async () => {
    try {
      const selectedFolder = await window.electronAPI.selectFolder();

      if (selectedFolder) {
        setPathInvalid(false);
        setProjectPath(selectedFolder);
      }
    } catch (error) {
      console.error("Failed to select a project folder", error);
    }
  };

  const handleBrowseImages = async () => {
    try {
      const images = await window.electronAPI.selectImages();
      mergeSelectedImages(images);
    } catch (error) {
      console.error("Failed to select project images", error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <style>{`
        @keyframes projectCreateShake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-4px); }
          30% { transform: translateX(4px); }
          45% { transform: translateX(-3px); }
          60% { transform: translateX(3px); }
          75% { transform: translateX(-2px); }
          90% { transform: translateX(2px); }
        }
      `}</style>

      {/* Header */}
      <div className="px-8 py-6 border-b border-border">
        <h1 className="text-2xl mb-2">Create New Project</h1>
        <p className="text-sm text-muted-foreground">
          Set up a new photogrammetry project and configure processing options
        </p>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          {/* Project Information */}
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-base mb-4">Project Information</h2>
            
            <div className="space-y-4">
              {/* Project Name */}
              <div>
                <label className="block text-sm mb-2">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  aria-invalid={validationAttempted && !isProjectNameValid}
                  placeholder="Enter project name"
                  className={`w-full px-4 py-2.5 bg-input border rounded-lg outline-none focus:ring-2 focus:ring-primary transition-all ${
                    validationAttempted && !isProjectNameValid
                      ? "border-red-500 ring-1 ring-red-500/50"
                      : "border-border"
                  }`}
                />
              </div>

              {/* Project Location */}
              <div>
                <label className="block text-sm mb-2">Project Location (Optional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={projectPath}
                    onChange={(e) => {
                      setPathInvalid(false);
                      setProjectPath(e.target.value);
                    }}
                    aria-invalid={validationAttempted && !isProjectPathValid}
                    placeholder={
                      defaultProjectLocation
                        ? `Default: ${defaultProjectLocation}`
                        : "Select project folder"
                    }
                    className={`flex-1 px-4 py-2.5 bg-input border rounded-lg outline-none focus:ring-2 focus:ring-primary transition-all ${
                      validationAttempted && !isProjectPathValid
                        ? "border-red-500 ring-1 ring-red-500/50"
                        : "border-border"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleBrowseProjectLocation}
                    className="px-4 py-2.5 bg-secondary hover:bg-accent border border-border rounded-lg transition-colors flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Browse
                  </button>
                </div>
                {defaultProjectLocation && !projectPath.trim() && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Using default project location: {defaultProjectLocation}
                  </p>
                )}
                {!defaultProjectLocation && !projectPath.trim() && (
                  <p className="text-xs text-red-500 mt-2">
                    Set a path here or configure a default project location in Settings.
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  aria-invalid={validationAttempted && !isDescriptionValid}
                  placeholder="Enter project description"
                  rows={3}
                  className={`w-full px-4 py-2.5 bg-input border rounded-lg outline-none focus:ring-2 focus:ring-primary transition-all resize-none ${
                    validationAttempted && !isDescriptionValid
                      ? "border-red-500 ring-1 ring-red-500/50"
                      : "border-border"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Image Import */}
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-base mb-4">Import Images</h2>
            
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-all
                ${
                  dragActive
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }
              `}
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                mergeSelectedImages(collectDroppedImages(e.dataTransfer.files));
              }}
            >
              <div className="w-16 h-16 bg-accent rounded-lg flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-base mb-2">Drag and drop images here</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Support for .JPG, .PNG, .TIFF formats
              </p>
              <button
                type="button"
                onClick={handleBrowseImages}
                className="px-6 py-2.5 bg-secondary hover:bg-accent border border-border rounded-lg transition-colors"
              >
                Browse Files
              </button>
            </div>

            <div className="mt-4 text-sm text-muted-foreground space-y-2">
              <p>
                {selectedImageCount} images selected
                {selectedImageCount > 0 ? ` · ${formatFileSize(selectedImageSize)} total` : ""}
              </p>
              <p className={validationAttempted && !hasEnoughImages ? "text-red-500" : ""}>
                Select at least 5 images
              </p>

              {selectedImages.length > 0 && (
                <div className="max-h-44 overflow-auto rounded-lg border border-border bg-input/40 p-3 space-y-2">
                  {selectedImages.map((image) => (
                    <div
                      key={image.path}
                      className="flex items-center justify-between gap-3 text-xs text-foreground"
                    >
                      <span className="truncate">{image.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatFileSize(image.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Processing Options */}
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-base mb-4">Processing Options</h2>
            
            <div className="space-y-4">
              <ToggleOption
                label="Generate 3D Model"
                description="Create mesh and textured 3D model (.OBJ)"
                checked={generate3D}
                onChange={setGenerate3D}
                invalid={validationAttempted && !hasAtLeastOneOption}
              />
              <ToggleOption
                label="Generate Orthophoto"
                description="Create georeferenced orthophoto map"
                checked={generateOrtho}
                onChange={setGenerateOrtho}
                invalid={validationAttempted && !hasAtLeastOneOption}
              />
              <ToggleOption
                label="Generate NDVI"
                description="Generate vegetation index for multispectral images"
                checked={generateNDVI}
                onChange={setGenerateNDVI}
                invalid={validationAttempted && !hasAtLeastOneOption}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => navigate("/")}
              className="px-6 py-2.5 bg-secondary hover:bg-accent border border-border rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProject}
              disabled={isCreating}
              className={`px-6 py-2.5 text-white rounded-lg transition-colors flex items-center gap-2 disabled:cursor-not-allowed ${
                shouldShowCreateErrorAnimation
                  ? "bg-red-600 hover:bg-red-500"
                  : "bg-primary hover:bg-primary/90"
              }`}
              style={
                shouldShowCreateErrorAnimation
                  ? { animation: "projectCreateShake 0.45s ease-in-out 1" }
                  : undefined
              }
              key={createNudgeKey}
            >
              {isCreating ? "Creating..." : "Create Project"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewProject;