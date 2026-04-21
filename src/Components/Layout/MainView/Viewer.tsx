/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect } from "react";
import {
  Grid3x3,
  Lightbulb,
  Maximize2,
  RotateCcw,
  Box,
  Ruler,
  Camera,
  Navigation,
  Monitor,
  FileImage,
  Map,
  TreePine,
  Cuboid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Switch from "@radix-ui/react-switch";
import * as THREE from "three";
import L from "leaflet";
import GoogleMutant from "leaflet.gridlayer.googlemutant/src/Leaflet.GoogleMutant.mjs";
import proj4 from "proj4";
import { fromArrayBuffer } from "geotiff";
import DxfParser from "dxf-parser";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, where, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../../Config/Firebase";
import "leaflet/dist/leaflet.css";

const hasElectronApi = () =>
  typeof window !== "undefined" && window.electronAPI !== undefined;

type SavedViewState = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  target: [number, number, number];
  zoom: number;
};

type MeasurementPoint = {
  x: number;
  y: number;
  z: number;
};

type GeoPoint = {
  x: number;
  y: number;
};

type OrthophotoLayerControl = {
  name: string;
  visible: boolean;
  opacity: number;
};

type OrthophotoLayerControls = {
  raster: { visible: boolean; opacity: number };
  dxf: OrthophotoLayerControl[];
};

type OrthophotoCompanionImage = {
  width: number;
  height: number;
  url: string;
  georef: { sourceCrs: string | null; rawCorners: GeoPoint[] } | null;
  renderInfo: {
    kind: "png-decoded" | "native-image";
    samples: number | null;
  };
};

type DxfEntity = {
  type: string;
  vertices?: Array<{ x: number; y: number }>;
  shape?: boolean;
  closed?: boolean;
  position?: { x: number; y: number };
  center?: { x: number; y: number };
  radius?: number;
  startAngle?: number;
  endAngle?: number;
};

type OrthophotoBasemapConfig =
  | {
      label: string;
      kind: "tile";
      url: string;
      options: L.TileLayerOptions;
    }
  | {
      label: string;
      kind: "google";
      googleType: "roadmap" | "satellite" | "terrain" | "hybrid";
      options?: L.GridLayerOptions;
    };

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || "";
const ENABLE_GOOGLE_BASEMAP = (import.meta.env.VITE_ENABLE_GOOGLE_BASEMAP as string | undefined) === "true";
const GOOGLE_MAPS_SCRIPT_URL = "https://maps.googleapis.com/maps/api/js";
let googleMapsScriptPromise: Promise<void> | null = null;

const ensureGoogleMapsLoaded = () => {
  const globalWindow = window as unknown as Window & {
    google?: unknown;
    [key: string]: unknown;
  };

  if (globalWindow.google) {
    return Promise.resolve();
  }

  if (!ENABLE_GOOGLE_BASEMAP) {
    return Promise.reject(
      new Error("Google basemap is disabled. Set VITE_ENABLE_GOOGLE_BASEMAP=true to enable it.")
    );
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(
      new Error("Google Maps API key is missing. Set VITE_GOOGLE_MAPS_API_KEY in your environment.")
    );
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[data-google-maps-api="true"]'
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if (globalWindow.google) {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Maps script.")),
        { once: true }
      );
      return;
    }

    const callbackName = `__googleMapsInit_${Date.now()}`;
    globalWindow[callbackName] = () => {
      delete globalWindow[callbackName];
      resolve();
    };

    const script = document.createElement("script");
    script.dataset.googleMapsApi = "true";
    script.async = true;
    script.defer = true;
    script.src = `${GOOGLE_MAPS_SCRIPT_URL}?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=${callbackName}`;
    script.onerror = () => {
      delete globalWindow[callbackName];
      reject(new Error("Failed to load Google Maps script."));
    };

    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
};

const ORTHOPHOTO_BASEMAPS = {
  googleSatellite: {
    label: "Google Earth-like Satellite",
    kind: "google",
    googleType: "satellite",
    options: {
      maxZoom: 21,
    } as L.GridLayerOptions,
  },
  googleHybrid: {
    label: "Google Hybrid",
    kind: "google",
    googleType: "hybrid",
    options: {
      maxZoom: 21,
    } as L.GridLayerOptions,
  },
  googleTerrain: {
    label: "Google Terrain",
    kind: "google",
    googleType: "terrain",
    options: {
      maxZoom: 20,
    } as L.GridLayerOptions,
  },
  googleRoadmap: {
    label: "Google Roadmap",
    kind: "google",
    googleType: "roadmap",
    options: {
      maxZoom: 20,
    } as L.GridLayerOptions,
  },
  terrain: {
    label: "Terrain (OpenTopoMap)",
    kind: "tile",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 17,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: <a href="https://opentopomap.org">OpenTopoMap</a>',
    } as L.TileLayerOptions,
  },
  street: {
    label: "Street (OSM)",
    kind: "tile",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    } as L.TileLayerOptions,
  },
  satellite: {
    label: "Satellite (Esri)",
    kind: "tile",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri",
    } as L.TileLayerOptions,
  },
} as const satisfies Record<string, OrthophotoBasemapConfig>;

const ORTHOPHOTO_HILLSHADE = {
  url: "https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png",
  options: {
    maxZoom: 18,
    opacity: 0.35,
    attribution: "Hillshade &copy; OpenStreetMap contributors",
  } as L.TileLayerOptions,
};

const ORTHOPHOTO_EPSG_DEFS: Record<string, string> = {
  "EPSG:32631": "+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs",
  "EPSG:32632": "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs",
  "EPSG:32633": "+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs",
  "EPSG:25831": "+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs",
  "EPSG:25832": "+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs",
  "EPSG:25833": "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs",
  "EPSG:23032": "+proj=utm +zone=32 +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs",
};

const ensureProjectionDefinitions = () => {
  for (const [code, definition] of Object.entries(ORTHOPHOTO_EPSG_DEFS)) {
    if (!proj4.defs(code)) {
      proj4.defs(code, definition);
    }
  }
};

const applyWorldFileTransform = (coefficients: number[], col: number, row: number) => {
  const [A, D, B, E, C, F] = coefficients;
  return {
    x: A * col + B * row + C,
    y: D * col + E * row + F,
  };
};

const parseTfw = (text: string) => {
  const values = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => Number.parseFloat(line));

  if (values.length !== 6 || values.some((value) => Number.isNaN(value))) {
    throw new Error("Invalid .tfw contents. Expected 6 numeric lines.");
  }

  return values;
};

const getFileBasename = (name: string) => {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(0, index).toLowerCase() : name.toLowerCase();
};

const findCompanionFile = (files: File[], basename: string, extensions: string[]) =>
  files.find((file) => {
    const lowerName = file.name.toLowerCase();
    return extensions.some((extension) => lowerName === `${basename}${extension}`);
  });

const loadImageSize = (file: File): Promise<{ width: number; height: number; url: string }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight, url });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "Cannot open companion image file. Use a web image format like .png, .jpg, .jpeg, or .webp."
        )
      );
    };

    image.src = url;
  });

const clampToByte = (value: number) => {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
};

const getMinMax = (array: ArrayLike<number>) => {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < array.length; index += 1) {
    const value = array[index];
    if (value === undefined || Number.isNaN(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { min: 0, max: 1 };
  }

  return { min, max };
};

const stretchToByte = (value: number, min: number, max: number) => {
  const t = (value - min) / (max - min);
  return clampToByte(t * 255);
};

const loadTiffAsOverlay = async (file: File): Promise<OrthophotoCompanionImage> => {
  const buffer = await file.arrayBuffer();
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const rasters = await image.readRasters({ interleave: false });
  const sampleCount = rasters.length;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create canvas context for TIFF rendering.");
  }

  const imageData = context.createImageData(width, height);
  const output = imageData.data;
  const pixelCount = width * height;

  if (sampleCount >= 3) {
    const red = rasters[0]!;
    const green = rasters[1]!;
    const blue = rasters[2]!;
    const alpha = sampleCount >= 4 ? rasters[3]! : null;

    const redMinMax = getMinMax(red);
    const greenMinMax = getMinMax(green);
    const blueMinMax = getMinMax(blue);
    const alphaMinMax = alpha ? getMinMax(alpha) : null;

    for (let index = 0; index < pixelCount; index += 1) {
      const offset = index * 4;
      output[offset] = stretchToByte(red[index]!, redMinMax.min, redMinMax.max);
      output[offset + 1] = stretchToByte(green[index]!, greenMinMax.min, greenMinMax.max);
      output[offset + 2] = stretchToByte(blue[index]!, blueMinMax.min, blueMinMax.max);
      output[offset + 3] = alpha
        ? stretchToByte(alpha[index]!, alphaMinMax!.min, alphaMinMax!.max)
        : 255;
    }
  } else {
    const gray = rasters[0]!;
    const grayMinMax = getMinMax(gray);

    for (let index = 0; index < pixelCount; index += 1) {
      const offset = index * 4;
      const grayValue = stretchToByte(gray[index]!, grayMinMax.min, grayMinMax.max);
      output[offset] = grayValue;
      output[offset + 1] = grayValue;
      output[offset + 2] = grayValue;
      output[offset + 3] = 255;
    }
  }

  context.putImageData(imageData, 0, 0);
  const url = await new Promise<string>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode TIFF preview as PNG."));
          return;
        }

        resolve(URL.createObjectURL(blob));
      },
      "image/png"
    );
  });

  let georef: OrthophotoCompanionImage["georef"] = null;
  try {
    const bbox = image.getBoundingBox();
    const geoKeys = image.getGeoKeys ? image.getGeoKeys() : null;
    let detectedCrs: string | null = null;

    if (geoKeys) {
      const projected = geoKeys.ProjectedCSTypeGeoKey;
      const geographic = geoKeys.GeographicTypeGeoKey;

      if (Number.isFinite(projected) && projected > 0) {
        detectedCrs = `EPSG:${projected}`;
      } else if (Number.isFinite(geographic) && geographic > 0) {
        detectedCrs = `EPSG:${geographic}`;
      }
    }

    if (bbox && bbox.length === 4 && bbox.every(Number.isFinite)) {
      georef = {
        sourceCrs: detectedCrs,
        rawCorners: [
          { x: bbox[0], y: bbox[1] },
          { x: bbox[2], y: bbox[1] },
          { x: bbox[2], y: bbox[3] },
          { x: bbox[0], y: bbox[3] },
        ],
      };
    }
  } catch {
    georef = null;
  }

  return {
    width,
    height,
    url,
    georef,
    renderInfo: {
      kind: "png-decoded",
      samples: sampleCount,
    },
  };
};

const loadCompanionImage = async (file: File): Promise<OrthophotoCompanionImage> => {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".tif") || lowerName.endsWith(".tiff")) {
    return loadTiffAsOverlay(file);
  }

  const nativeImage = await loadImageSize(file);
  return {
    ...nativeImage,
    georef: null,
    renderInfo: {
      kind: "native-image",
      samples: null,
    },
  };
};

const normalizeCrs = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "EPSG:32632";
  if (/^\d+$/.test(trimmed)) {
    return `EPSG:${trimmed}`;
  }
  return trimmed;
};

const inferEpsgFromPrjText = (prjText: string) => {
  const authorityMatch = prjText.match(/AUTHORITY\s*\[\s*"EPSG"\s*,\s*"(\d+)"\s*\]/i);
  if (authorityMatch?.[1]) {
    return `EPSG:${authorityMatch[1]}`;
  }

  const utmMatch = prjText.match(/UTM\s*ZONE\s*(\d{1,2})([NS])?/i);
  if (utmMatch?.[1]) {
    const zone = Number.parseInt(utmMatch[1], 10);
    const hemisphere = (utmMatch[2] || "N").toUpperCase();
    if (zone >= 1 && zone <= 60) {
      return hemisphere === "S" ? `EPSG:${32700 + zone}` : `EPSG:${32600 + zone}`;
    }
  }

  return null;
};

const boundsFromCorners = (corners: GeoPoint[]) => ({
  minX: Math.min(...corners.map((corner) => corner.x)),
  maxX: Math.max(...corners.map((corner) => corner.x)),
  minY: Math.min(...corners.map((corner) => corner.y)),
  maxY: Math.max(...corners.map((corner) => corner.y)),
});

const validateWgs84Bounds = (bounds: { minX: number; maxX: number; minY: number; maxY: number }) => {
  const allFinite = [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY].every(Number.isFinite);
  if (!allFinite) return false;
  if (bounds.minY < -90 || bounds.maxY > 90) return false;
  if (bounds.minX < -180 || bounds.maxX > 180) return false;
  return true;
};

const transformCornersToLonLat = (rawCorners: GeoPoint[], sourceCrs: string): GeoPoint[] => {
  if (sourceCrs.toUpperCase() === "EPSG:4326") {
    return rawCorners;
  }

  return rawCorners.map((point) => {
    const transformed = proj4(sourceCrs, "EPSG:4326", [point.x, point.y]);
    return { x: transformed[0], y: transformed[1] };
  });
};

const toLatLng = (x: number, y: number, sourceCrs: string): L.LatLngTuple => {
  if (sourceCrs.toUpperCase() === "EPSG:4326") {
    return [y, x];
  }

  const transformed = proj4(sourceCrs, "EPSG:4326", [x, y]);
  return [transformed[1], transformed[0]];
};

const makeLineStyle = (): L.PathOptions => ({
  color: "#ff5a2a",
  weight: 2,
  opacity: 0.9,
});

const makeFillStyle = (): L.PathOptions => ({
  color: "#ff5a2a",
  weight: 2,
  opacity: 0.9,
  fillColor: "#ff7b45",
  fillOpacity: 0.15,
});

const arcPoints = (center: { x: number; y: number }, radius: number, startDeg: number, endDeg: number, steps = 64) => {
  const points: GeoPoint[] = [];
  const from = startDeg;
  let to = endDeg;

  if (to < from) {
    to += 360;
  }

  const total = Math.max(4, Math.min(steps, Math.ceil((to - from) / 5)));
  for (let index = 0; index <= total; index += 1) {
    const t = index / total;
    const degrees = from + (to - from) * t;
    const radians = (degrees * Math.PI) / 180;
    points.push({
      x: center.x + Math.cos(radians) * radius,
      y: center.y + Math.sin(radians) * radius,
    });
  }

  return points;
};

const renderDxfToLayer = (dxfText: string, sourceCrs: string) => {
  const parser = new DxfParser();
  const parsed = parser.parseSync(dxfText) as { entities?: DxfEntity[] };
  const group = L.featureGroup();

  for (const entity of parsed.entities || []) {
    if (entity.type === "LINE" && entity.vertices && entity.vertices.length >= 2) {
      const points = entity.vertices.slice(0, 2).map((vertex) => toLatLng(vertex.x, vertex.y, sourceCrs));
      group.addLayer(L.polyline(points, makeLineStyle()));
      continue;
    }

    if (
      (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") &&
      entity.vertices &&
      entity.vertices.length >= 2
    ) {
      const points = entity.vertices.map((vertex) => toLatLng(vertex.x, vertex.y, sourceCrs));
      const isClosed = Boolean(entity.shape || entity.closed);
      if (isClosed && points.length >= 3) {
        group.addLayer(L.polygon(points, makeFillStyle()));
      } else {
        group.addLayer(L.polyline(points, makeLineStyle()));
      }
      continue;
    }

    if (entity.type === "POINT" && entity.position) {
      group.addLayer(
        L.circleMarker(toLatLng(entity.position.x, entity.position.y, sourceCrs), {
          radius: 4,
          color: "#173f8a",
          weight: 1,
          fillColor: "#3b82f6",
          fillOpacity: 0.9,
        })
      );
      continue;
    }

    if (
      entity.type === "CIRCLE" &&
      entity.center &&
      typeof entity.radius === "number" &&
      Number.isFinite(entity.radius) &&
      entity.radius > 0
    ) {
      const points = arcPoints(entity.center, entity.radius, 0, 360).map((point) =>
        toLatLng(point.x, point.y, sourceCrs)
      );
      group.addLayer(L.polygon(points, makeFillStyle()));
      continue;
    }

    if (
      entity.type === "ARC" &&
      entity.center &&
      typeof entity.radius === "number" &&
      Number.isFinite(entity.radius) &&
      entity.radius > 0 &&
      typeof entity.startAngle === "number" &&
      Number.isFinite(entity.startAngle) &&
      typeof entity.endAngle === "number" &&
      Number.isFinite(entity.endAngle)
    ) {
      const points = arcPoints(entity.center, entity.radius, entity.startAngle, entity.endAngle).map((point) =>
        toLatLng(point.x, point.y, sourceCrs)
      );
      group.addLayer(L.polyline(points, makeLineStyle()));
    }
  }

  return {
    layer: group,
    entitiesTotal: (parsed.entities || []).length,
    entitiesRendered: group.getLayers().length,
  };
};

const setVectorLayerOpacity = (groupLayer: L.FeatureGroup, opacity: number) => {
  const fillOpacity = Math.min(0.5, Math.max(0.1, opacity * 0.35));
  groupLayer.eachLayer((layer) => {
    if ((layer as L.Path).setStyle) {
      (layer as L.Path).setStyle({ opacity, fillOpacity });
    }
  });
};

type PointCloudColorMode = "rgb" | "elevation" | "intensity" | "classification";

const swapYAndZInAttribute = (attribute: THREE.BufferAttribute) => {
  for (let index = 0; index < attribute.count; index += 1) {
    const y = attribute.getY(index);
    const z = attribute.getZ(index);
    attribute.setY(index, z);
    attribute.setZ(index, y);
  }
  attribute.needsUpdate = true;
};

const swapYAndZInGeometry = (geometry: THREE.BufferGeometry) => {
  const position = geometry.getAttribute("position");
  if (position && position.itemSize >= 3 && position instanceof THREE.BufferAttribute) {
    swapYAndZInAttribute(position);
  }

  const normal = geometry.getAttribute("normal");
  if (normal && normal.itemSize >= 3 && normal instanceof THREE.BufferAttribute) {
    swapYAndZInAttribute(normal);
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
};

type ViewerProps = {
  projectIdOverride?: string | null;
  isActive?: boolean;
};

export function Viewer({ projectIdOverride, isActive = true }: ViewerProps = {}) {
  const { projectId: routeProjectId } = useParams();
  const projectId = projectIdOverride ?? routeProjectId;
  const navigate = useNavigate();
  const [dataType, setDataType] = useState<"3d" | "orthophoto" | "ndvi">("3d");
  const [viewMode, setViewMode] = useState<"mesh" | "pointcloud">("mesh");
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [lighting, setLighting] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showShadows, setShowShadows] = useState(false);
  const [ambientOcclusion, setAmbientOcclusion] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("#071126");
  const [renderQuality, setRenderQuality] = useState<"low" | "medium" | "high" | "ultra">("high");
  const [fieldOfView, setFieldOfView] = useState(60);
  const [pointSize, setPointSize] = useState(0.02);
  const [colorMode, setColorMode] = useState<PointCloudColorMode>("rgb");
  const [meshOpacity, setMeshOpacity] = useState(100);
  const [measurementTool, setMeasurementTool] = useState<"distance" | "area" | null>(null);
  const [distancePoints, setDistancePoints] = useState<MeasurementPoint[]>([]);
  const [areaPoints, setAreaPoints] = useState<MeasurementPoint[]>([]);
  const [plyGeometry, setPlyGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [sceneObject, setSceneObject] = useState<THREE.Object3D | null>(null);
  const [plyName, setPlyName] = useState("demo_point_cloud.ply");
  const [loadedFilePath, setLoadedFilePath] = useState("");
  const [status, setStatus] = useState("Ready");
  const [pointCount, setPointCount] = useState(0);
  const [rasterName, setRasterName] = useState("demo_orthophoto.png");
  const [plyError, setPlyError] = useState("");
  const [isLoadingPly, setIsLoadingPly] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [rasterRevision, setRasterRevision] = useState(0);
  const [currentProjectRootPath, setCurrentProjectRootPath] = useState("");
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(auth.currentUser?.uid ?? null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measurementCanvasRef = useRef<HTMLCanvasElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  const orthophotoMapNodeRef = useRef<HTMLDivElement | null>(null);
  const orthophotoMapRef = useRef<L.Map | null>(null);
  const orthophotoBasemapLayerRef = useRef<L.Layer | null>(null);
  const orthophotoHillshadeLayerRef = useRef<L.TileLayer | null>(null);
  const orthophotoRasterLayerRef = useRef<L.ImageOverlay | null>(null);
  const orthophotoDxfLayerRefs = useRef<Record<string, L.FeatureGroup>>({});
  const orthophotoDataBoundsRef = useRef<L.LatLngBounds | null>(null);
  const orthophotoRasterUrlRef = useRef<string | null>(null);
  const lastSelectedOrthophotoFilesRef = useRef<File[]>([]);
  const lastOrthophotoRawCornersRef = useRef<GeoPoint[] | null>(null);
  const rasterImageRef = useRef<HTMLImageElement | null>(null);
  const dragDepthRef = useRef(0);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const activeCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const activeControlsRef = useRef<OrbitControls | null>(null);
  const cameraTransitionFrameRef = useRef<number | null>(null);
  const measurementPlaneYRef = useRef(0);
  const lastAutoLoadedProjectIdRef = useRef<string | null>(null);
  const lastAutoLoadedOrthophotoProjectIdRef = useRef<string | null>(null);
  const autoCapturedProjectIconIdRef = useRef<string | null>(null);
  const viewerSettingsRef = useRef({
    backgroundColor,
    renderQuality,
    fieldOfView,
    pointSize,
    colorMode,
    meshOpacity,
    lighting,
    showGrid,
    showAxes,
    showShadows,
    wireframe,
    showMeasurements,
    measurementTool,
    distancePoints,
    areaPoints,
  });
  const saved3DViewStateRef = useRef<SavedViewState | null>(null);
  const [isOrthophotoBusy, setIsOrthophotoBusy] = useState(false);
  const [orthophotoStatus, setOrthophotoStatus] = useState("Ready");
  const [orthophotoSourceCrsInput] = useState("EPSG:32632");
  const [orthophotoBasemapId, setOrthophotoBasemapId] = useState<keyof typeof ORTHOPHOTO_BASEMAPS>("satellite");
  const [showOrthophotoHillshade, setShowOrthophotoHillshade] = useState(false);
  const [orthophotoLayerControls, setOrthophotoLayerControls] = useState<OrthophotoLayerControls>({
    raster: { visible: true, opacity: 0.88 },
    dxf: [],
  });
  const plyHasFaces = Boolean(plyGeometry?.getIndex());
  const effective3DViewMode = sceneObject ? viewMode : (plyGeometry && !plyHasFaces ? "pointcloud" : viewMode);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setViewerUserId(user?.uid ?? null);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    viewerSettingsRef.current = {
      backgroundColor,
      renderQuality,
      fieldOfView,
      pointSize,
      colorMode,
      meshOpacity,
      lighting,
      showGrid,
      showAxes,
      showShadows,
      wireframe,
      showMeasurements,
      measurementTool,
      distancePoints,
      areaPoints,
    };
  }, [
    backgroundColor,
    renderQuality,
    fieldOfView,
    pointSize,
    colorMode,
    meshOpacity,
    lighting,
    showGrid,
    showAxes,
    showShadows,
    wireframe,
    showMeasurements,
    measurementTool,
    distancePoints,
    areaPoints,
  ]);

  const plyLoader = useRef(new PLYLoader()).current;

  const applyPointCloudColorMode = (pointsObject: THREE.Points, mode: PointCloudColorMode) => {
    const material = Array.isArray(pointsObject.material) ? pointsObject.material[0] : pointsObject.material;
    if (!(material instanceof THREE.PointsMaterial)) {
      return;
    }

    const geometry = pointsObject.geometry;
    const alreadyAppliedMode = geometry.userData.appliedPointCloudColorMode as PointCloudColorMode | undefined;
    if (alreadyAppliedMode === mode) {
      return;
    }

    const positionAttribute = geometry.getAttribute("position");
    if (!(positionAttribute instanceof THREE.BufferAttribute)) {
      return;
    }

    const existingColorAttribute = geometry.getAttribute("color");
    if (
      !geometry.userData.originalColorAttribute &&
      existingColorAttribute &&
      existingColorAttribute instanceof THREE.BufferAttribute
    ) {
      geometry.userData.originalColorAttribute = existingColorAttribute.clone();
    }

    if (mode === "rgb") {
      const originalColorAttribute = geometry.userData.originalColorAttribute;
      if (originalColorAttribute instanceof THREE.BufferAttribute) {
        geometry.setAttribute("color", originalColorAttribute.clone());
        material.vertexColors = true;
        material.color.set("#ffffff");
      } else {
        geometry.deleteAttribute("color");
        material.vertexColors = false;
        material.color.set("#f3c969");
      }
      geometry.userData.appliedPointCloudColorMode = mode;
      material.needsUpdate = true;
      return;
    }

    const scalarSourceMode =
      mode === "elevation" || geometry.getAttribute(mode) instanceof THREE.BufferAttribute
        ? mode
        : "elevation";
    const scalarAttribute =
      scalarSourceMode === "elevation"
        ? positionAttribute
        : (geometry.getAttribute(scalarSourceMode) as THREE.BufferAttribute);

    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;
    const scalarValues = new Float32Array(positionAttribute.count);

    for (let index = 0; index < positionAttribute.count; index += 1) {
      const scalarValue =
        scalarSourceMode === "elevation" ? positionAttribute.getY(index) : scalarAttribute.getX(index);
      scalarValues[index] = scalarValue;
      minValue = Math.min(minValue, scalarValue);
      maxValue = Math.max(maxValue, scalarValue);
    }

    const range = Math.max(maxValue - minValue, 1e-6);
    const colors = new Float32Array(positionAttribute.count * 3);
    const gradientColor = new THREE.Color();

    for (let index = 0; index < positionAttribute.count; index += 1) {
      const normalized = (scalarValues[index] - minValue) / range;
      gradientColor.setHSL((1 - normalized) * 0.65, 1, 0.5);
      const colorOffset = index * 3;
      colors[colorOffset] = gradientColor.r;
      colors[colorOffset + 1] = gradientColor.g;
      colors[colorOffset + 2] = gradientColor.b;
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.userData.appliedPointCloudColorMode = mode;
    material.vertexColors = true;
    material.color.set("#ffffff");
    material.needsUpdate = true;
  };

  const applyRootAppearanceSettings = () => {
    const root = rootRef.current;
    if (!root) return;

    const settings = viewerSettingsRef.current;

    root.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = settings.showShadows;
        object.receiveShadow = settings.showShadows;

        const material = Array.isArray(object.material) ? object.material[0] : object.material;
        if (!material) return;

        const meshMaterial = material as THREE.Material & {
          wireframe?: boolean;
          transparent?: boolean;
          opacity?: number;
          needsUpdate?: boolean;
        };

        if ("wireframe" in meshMaterial) {
          meshMaterial.wireframe = settings.wireframe;
        }
        if ("opacity" in meshMaterial) {
          meshMaterial.transparent = settings.meshOpacity < 100;
          meshMaterial.opacity = settings.meshOpacity / 100;
        }
        meshMaterial.needsUpdate = true;
      }

      if (object instanceof THREE.Points) {
        const material = Array.isArray(object.material) ? object.material[0] : object.material;
        if (material instanceof THREE.PointsMaterial) {
          applyPointCloudColorMode(object, settings.colorMode);
          material.size = settings.pointSize;
          material.transparent = settings.meshOpacity < 100;
          material.opacity = settings.meshOpacity / 100;
          material.depthWrite = settings.meshOpacity === 100;
          material.needsUpdate = true;
        }
      }
    });
  };

  const applySceneSettings = () => {
    const settings = viewerSettingsRef.current;

    if (rendererRef.current) {
      rendererRef.current.setPixelRatio(
        Math.min(
          window.devicePixelRatio *
            (settings.renderQuality === "low"
              ? 0.7
              : settings.renderQuality === "medium"
                ? 1
                : settings.renderQuality === "high"
                  ? 1.25
                  : 1.5),
          2.5
        )
      );
      rendererRef.current.shadowMap.enabled = settings.showShadows;
      rendererRef.current.setClearColor(settings.backgroundColor);
    }

    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(settings.backgroundColor);
    }

    if (gridRef.current) {
      gridRef.current.visible = settings.showGrid;
    }

    if (axesRef.current) {
      axesRef.current.visible = settings.showAxes;
    }

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = settings.lighting ? 0.8 : 0.15;
    }

    if (directionalLightRef.current) {
      directionalLightRef.current.intensity = settings.lighting ? 0.9 : 0;
      directionalLightRef.current.castShadow = settings.showShadows;
    }

    applyRootAppearanceSettings();

    if (activeCameraRef.current) {
      activeCameraRef.current.fov = settings.fieldOfView;
      activeCameraRef.current.updateProjectionMatrix();
    }

    if (activeControlsRef.current) {
      activeControlsRef.current.enabled = !(settings.showMeasurements && settings.measurementTool !== null);
    }
  };

  useEffect(() => {
    applySceneSettings();
  }, [
    backgroundColor,
    renderQuality,
    fieldOfView,
    pointSize,
    colorMode,
    meshOpacity,
    lighting,
    showGrid,
    showAxes,
    showShadows,
    wireframe,
    showMeasurements,
    measurementTool,
  ]);

  const distanceBetweenPoints = (first: MeasurementPoint, second: MeasurementPoint) => {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const dz = second.z - first.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const polygonAreaFromPoints = (points: MeasurementPoint[]) => {
    if (points.length < 3) return 0;

    let sum = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % points.length];
      if (!current || !next) continue;
      sum += current.x * next.z - next.x * current.z;
    }

    return Math.abs(sum) / 2;
  };

  const normalizePath = (value: string) => value.replace(/\//g, "\\").replace(/[\\/]+$/, "");

  const deriveProjectRootPathFromPlyPath = (filePath: string) => {
    const normalized = normalizePath(filePath);
    const parts = normalized.split("\\");
    const filterPointsIndex = parts.findIndex((part) => part.toLowerCase() === "odm_filterpoints");

    if (filterPointsIndex > 0) {
      return parts.slice(0, filterPointsIndex).join("\\");
    }

    return normalized.replace(/[\\/][^\\/]+$/, "");
  };

  const updateProjectRootPath = (filePath: string) => {
    setCurrentProjectRootPath(deriveProjectRootPathFromPlyPath(filePath));
  };

  const resetSaved3DViewStates = () => {
    saved3DViewStateRef.current = null;
  };

  const selectMeasurementTool = (tool: "distance" | "area") => {
    setShowMeasurements(true);
    setMeasurementTool((currentTool) => (currentTool === tool ? null : tool));
  };

  const handleShowMeasurementsChange = (nextValue: boolean) => {
    setShowMeasurements(nextValue);
    if (!nextValue) {
      setMeasurementTool(null);
    }
  };

  const captureAndSaveScreenshot = async () => {
    if (!hasElectronApi()) {
      setStatus("Electron bridge is unavailable. Start with \"npm run dev\".");
      return;
    }

    const rendererCanvas = threeContainerRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!rendererCanvas) {
      setStatus("Screenshot unavailable.");
      return;
    }

    const projectRootPath = currentProjectRootPath || deriveProjectRootPathFromPlyPath(loadedFilePath);
    if (!projectRootPath) {
      setStatus("Project folder not found for screenshot.");
      return;
    }

    const timestamp = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const fileName = `screenshot_${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}_${pad(timestamp.getHours())}-${pad(timestamp.getMinutes())}-${pad(timestamp.getSeconds())}.png`;
    const screenshotPath = joinPath(joinPath(projectRootPath, "Screenshots"), fileName);

    try {
      setStatus("Saving screenshot...");
      const dataUrl = rendererCanvas.toDataURL("image/png");
      await window.electronAPI.saveScreenshot({ filePath: screenshotPath, dataUrl });
      setStatus(`Screenshot saved to Screenshots/${fileName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save screenshot.";
      setPlyError(message);
      setStatus(message);
    }
  };

  const setPresetView = (view: "top" | "front" | "right") => {
    const camera = activeCameraRef.current;
    const controls = activeControlsRef.current;
    if (!camera || !controls) return;

    const target = controls.target.clone();
    const distance = Math.max(camera.position.distanceTo(target), 1);
    const direction = new THREE.Vector3(0, 0, 1);

    if (view === "top") {
      direction.set(0, 1, 0);
      camera.up.set(0, 0, -1);
    } else if (view === "right") {
      direction.set(1, 0, 0);
      camera.up.set(0, 1, 0);
    } else {
      direction.set(0, 0, 1);
      camera.up.set(0, 1, 0);
    }

    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    controls.target.copy(target);
    camera.updateProjectionMatrix();
    controls.update();

    saved3DViewStateRef.current = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      quaternion: [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w],
      target: [controls.target.x, controls.target.y, controls.target.z],
      zoom: camera.zoom,
    };
  };

  const cancelCameraTransition = () => {
    if (cameraTransitionFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraTransitionFrameRef.current);
      cameraTransitionFrameRef.current = null;
    }
  };

  useEffect(() => {
    if (dataType !== "ndvi") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      drawScene();
    };

    const drawScene = () => {
      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (dataType === "ndvi") {
        drawNDVI(ctx, canvas.width, canvas.height);
      }
    };

    const drawNDVI = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      if (rasterImageRef.current) {
        const image = rasterImageRef.current;
        const scale = Math.min(width / image.width, height / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;

        ctx.drawImage(image, x, y, drawWidth, drawHeight);

        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(16, 16, 280, 36);
        ctx.fillStyle = "#ffffff";
        ctx.font = "13px sans-serif";
        ctx.fillText("Imported raster preview (NDVI palette not computed)", 24, 39);
        return;
      }

      // Draw NDVI heat map
      const gridSize = 40;
      const colors = [
        "#8B0000", // Dark red (low vegetation)
        "#FF4500", // Orange-red
        "#FFA500", // Orange
        "#FFFF00", // Yellow
        "#9ACD32", // Yellow-green
        "#32CD32", // Lime green
        "#228B22", // Forest green
        "#006400", // Dark green (high vegetation)
      ];

      for (let y = 0; y < height; y += gridSize) {
        for (let x = 0; x < width; x += gridSize) {
          const colorIndex = Math.floor(Math.random() * colors.length);
          ctx.fillStyle = colors[colorIndex];
          ctx.fillRect(x, y, gridSize, gridSize);
        }
      }

      // Add legend
      const legendX = width - 120;
      const legendY = 40;
      const legendHeight = 200;
      const legendWidth = 30;

      // Draw gradient legend
      const gradient = ctx.createLinearGradient(0, legendY, 0, legendY + legendHeight);
      gradient.addColorStop(0, "#006400");
      gradient.addColorStop(0.33, "#32CD32");
      gradient.addColorStop(0.66, "#FFA500");
      gradient.addColorStop(1, "#8B0000");

      ctx.fillStyle = gradient;
      ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

      // Legend border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

      // Legend labels
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.fillText("High", legendX + legendWidth + 10, legendY + 10);
      ctx.fillText("Low", legendX + legendWidth + 10, legendY + legendHeight);

      // Add overlay text
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(20, 20, 180, 80);
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px sans-serif";
      ctx.fillText("NDVI Analysis", 30, 45);
      ctx.fillText("Mean: 0.68", 30, 65);
      ctx.fillText("Range: 0.21 - 0.89", 30, 85);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [backgroundColor, dataType, rasterRevision]);

  useEffect(() => {
    if (dataType !== "orthophoto") return;
    if (!orthophotoMapNodeRef.current || orthophotoMapRef.current) return;

    ensureProjectionDefinitions();

    const map = L.map(orthophotoMapNodeRef.current, {
      zoomControl: true,
      preferCanvas: true,
    }).setView([20, 0], 2);

    orthophotoMapRef.current = map;
    setOrthophotoStatus("Ready");
  }, [dataType]);

  useEffect(() => {
    return () => {
      if (orthophotoRasterUrlRef.current && orthophotoRasterUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(orthophotoRasterUrlRef.current);
      }

      if (orthophotoMapRef.current) {
        orthophotoMapRef.current.remove();
        orthophotoMapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (dataType !== "orthophoto") return;

    const map = orthophotoMapRef.current;
    if (!map) return;

    let cancelled = false;

    const constrainedBounds = orthophotoDataBoundsRef.current;
    if (!constrainedBounds) {
      if (orthophotoBasemapLayerRef.current) {
        map.removeLayer(orthophotoBasemapLayerRef.current);
        orthophotoBasemapLayerRef.current = null;
      }
      if (orthophotoHillshadeLayerRef.current) {
        map.removeLayer(orthophotoHillshadeLayerRef.current);
        orthophotoHillshadeLayerRef.current = null;
      }
      return;
    }

    const applyBasemap = async () => {
      try {
        if (orthophotoBasemapLayerRef.current) {
          map.removeLayer(orthophotoBasemapLayerRef.current);
        }

        const basemapLayer = await createOrthophotoBasemapLayer(orthophotoBasemapId, constrainedBounds);
        if (cancelled) return;

        basemapLayer.addTo(map);
        orthophotoBasemapLayerRef.current = basemapLayer;

        if (orthophotoHillshadeLayerRef.current) {
          map.removeLayer(orthophotoHillshadeLayerRef.current);
          orthophotoHillshadeLayerRef.current = null;
        }

        if (showOrthophotoHillshade) {
          const hillshadeLayer = createHillshadeLayer(constrainedBounds);
          hillshadeLayer.addTo(map);
          orthophotoHillshadeLayerRef.current = hillshadeLayer;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setOrthophotoStatus(`Basemap warning: ${message}`);

        const fallback = ORTHOPHOTO_BASEMAPS.satellite;
        if (orthophotoBasemapLayerRef.current) {
          map.removeLayer(orthophotoBasemapLayerRef.current);
        }

        const fallbackLayer = L.tileLayer(fallback.url, {
          ...fallback.options,
          bounds: constrainedBounds,
          noWrap: true,
          keepBuffer: 1,
          updateWhenIdle: true,
        });
        fallbackLayer.addTo(map);
        orthophotoBasemapLayerRef.current = fallbackLayer;
      }
    };

    void applyBasemap();

    return () => {
      cancelled = true;
    };
  }, [dataType, orthophotoBasemapId, showOrthophotoHillshade]);

  useEffect(() => {
    if (dataType !== "orthophoto") return;

    const map = orthophotoMapRef.current;
    if (!map) return;

    const rasterLayer = orthophotoRasterLayerRef.current;
    if (rasterLayer) {
      rasterLayer.setOpacity(orthophotoLayerControls.raster.opacity);

      if (orthophotoLayerControls.raster.visible) {
        if (!map.hasLayer(rasterLayer)) {
          rasterLayer.addTo(map);
        }
      } else if (map.hasLayer(rasterLayer)) {
        map.removeLayer(rasterLayer);
      }
    }

    for (const dxfLayerControl of orthophotoLayerControls.dxf) {
      const dxfLayer = orthophotoDxfLayerRefs.current[dxfLayerControl.name];
      if (!dxfLayer) continue;

      setVectorLayerOpacity(dxfLayer, dxfLayerControl.opacity);
      if (dxfLayerControl.visible) {
        if (!map.hasLayer(dxfLayer)) {
          dxfLayer.addTo(map);
        }
      } else if (map.hasLayer(dxfLayer)) {
        map.removeLayer(dxfLayer);
      }
    }
  }, [dataType, orthophotoLayerControls]);

  useEffect(() => {
    if (dataType !== "orthophoto") return;

    const map = orthophotoMapRef.current;
    if (!map) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        map.invalidateSize();

        const dataBounds = orthophotoDataBoundsRef.current;
        if (dataBounds?.isValid()) {
          map.fitBounds(dataBounds, { padding: [20, 20] });
        }
      });
    });

    const delayedReflow = window.setTimeout(() => {
      map.invalidateSize();

      const dataBounds = orthophotoDataBoundsRef.current;
      if (dataBounds?.isValid()) {
        map.fitBounds(dataBounds, { padding: [20, 20] });
      }
    }, 180);

    const handleResize = () => {
      map.invalidateSize();

      const dataBounds = orthophotoDataBoundsRef.current;
      if (dataBounds?.isValid()) {
        map.fitBounds(dataBounds, { padding: [20, 20] });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.clearTimeout(delayedReflow);
      window.removeEventListener("resize", handleResize);
    };
  }, [dataType]);

  useEffect(() => {
    const container = threeContainerRef.current;
    if (!container) return;

    let animationFrame = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    rendererRef.current = renderer;
    renderer.shadowMap.enabled = viewerSettingsRef.current.showShadows;
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio *
          (viewerSettingsRef.current.renderQuality === "low"
            ? 0.7
            : viewerSettingsRef.current.renderQuality === "medium"
              ? 1
              : viewerSettingsRef.current.renderQuality === "high"
                ? 1.25
                : 1.5),
        2.5
      )
    );
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(viewerSettingsRef.current.backgroundColor);

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    if (!isActive) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(viewerSettingsRef.current.backgroundColor);

    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    const camera = new THREE.PerspectiveCamera(fieldOfView, aspect, 0.01, 100000);

    camera.position.set(0, 0, 4);

    camera.fov = fieldOfView;
    camera.updateProjectionMatrix();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    activeCameraRef.current = camera;
    activeControlsRef.current = controls;

    const savedView = saved3DViewStateRef.current;
    if (savedView) {
      camera.position.set(...savedView.position);
      camera.quaternion.set(...savedView.quaternion);
      camera.zoom = savedView.zoom;
      controls.target.set(...savedView.target);
      camera.updateProjectionMatrix();
      controls.update();
    }

    const grid = new THREE.GridHelper(20, 20, 0x374151, 0x374151);
    gridRef.current = grid;
    grid.visible = viewerSettingsRef.current.showGrid;
    scene.add(grid);

    const axes = new THREE.AxesHelper(4);
    axesRef.current = axes;
    axes.visible = viewerSettingsRef.current.showAxes;
    scene.add(axes);

    const ambientLight = new THREE.AmbientLight("#ffffff", viewerSettingsRef.current.lighting ? 0.8 : 0.15);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight("#8cc9ff", viewerSettingsRef.current.lighting ? 0.9 : 0);
    directionalLightRef.current = dirLight;
    dirLight.position.set(3, 4, 5);
    dirLight.castShadow = viewerSettingsRef.current.showShadows;
    scene.add(dirLight);

    const root = new THREE.Group();
    rootRef.current = root;
    scene.add(root);

    if (sceneObject) {
      const useLiveReference = Boolean(sceneObject.userData?.keepLiveReference);
      if (useLiveReference) {
        root.add(sceneObject);
      } else {
        const imported = sceneObject.clone(true);

        // Clone materials/geometries so renderer cleanup won't mutate imported source references.
        imported.traverse((object: THREE.Object3D) => {
          if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;

          object.geometry = object.geometry.clone();
          if (Array.isArray(object.material)) {
            object.material = object.material.map((material) => material.clone());
          } else {
            object.material = object.material.clone();
          }

          if (object instanceof THREE.Mesh) {
            const material = Array.isArray(object.material) ? object.material[0] : object.material;
            const meshMaterial = material as THREE.Material & {
              wireframe?: boolean;
              transparent?: boolean;
              opacity?: number;
              needsUpdate?: boolean;
            };
            if ("wireframe" in meshMaterial) {
              meshMaterial.wireframe = viewerSettingsRef.current.wireframe;
            }
            if ("opacity" in meshMaterial) {
              meshMaterial.transparent = viewerSettingsRef.current.meshOpacity < 100;
              meshMaterial.opacity = viewerSettingsRef.current.meshOpacity / 100;
            }
            meshMaterial.needsUpdate = true;
            object.castShadow = viewerSettingsRef.current.showShadows;
            object.receiveShadow = viewerSettingsRef.current.showShadows;
          }

          if (object instanceof THREE.Points) {
            const material = Array.isArray(object.material) ? object.material[0] : object.material;
            if (material instanceof THREE.PointsMaterial) {
              material.size = viewerSettingsRef.current.pointSize;
              material.transparent = viewerSettingsRef.current.meshOpacity < 100;
              material.opacity = viewerSettingsRef.current.meshOpacity / 100;
            }
          }
        });

        root.add(imported);
      }
    } else {
      const colorAttribute = plyGeometry?.getAttribute("color") as THREE.BufferAttribute | undefined;
      const hasVertexColors = Boolean(colorAttribute);
      let geometry = plyGeometry?.clone();

      if (!geometry) {
        if (viewMode === "pointcloud") {
          const positions = new Float32Array(12000);
          for (let index = 0; index < positions.length; index += 3) {
            positions[index] = (Math.random() - 0.5) * 8;
            positions[index + 1] = (Math.random() - 0.5) * 8;
            positions[index + 2] = (Math.random() - 0.5) * 8;
          }
          geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        } else {
          geometry = new THREE.TorusKnotGeometry(1.7, 0.45, 220, 32);
        }
      }

      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      if (effective3DViewMode === "pointcloud") {
        const pointsMaterial = new THREE.PointsMaterial({
          size: viewerSettingsRef.current.pointSize,
          sizeAttenuation: true,
          color: hasVertexColors ? "#ffffff" : "#f3c969",
          vertexColors: hasVertexColors,
          transparent: viewerSettingsRef.current.meshOpacity < 100,
          opacity: viewerSettingsRef.current.meshOpacity / 100,
        });
        root.add(new THREE.Points(geometry, pointsMaterial));
      } else {
        if (!geometry.getAttribute("normal")) {
          geometry.computeVertexNormals();
        }

        const meshMaterial = new THREE.MeshStandardMaterial({
          color: hasVertexColors ? 0xffffff : 0x9ca3af,
          vertexColors: hasVertexColors,
          wireframe: viewerSettingsRef.current.wireframe,
          transparent: viewerSettingsRef.current.meshOpacity < 100,
          opacity: viewerSettingsRef.current.meshOpacity / 100,
        });

        const mesh = new THREE.Mesh(geometry, meshMaterial);
        mesh.castShadow = viewerSettingsRef.current.showShadows;
        mesh.receiveShadow = viewerSettingsRef.current.showShadows;
        root.add(mesh);
      }
    }

    const fitToObject = () => {
      const box = new THREE.Box3().setFromObject(root);
      if (box.isEmpty()) return;

      const target = box.getCenter(new THREE.Vector3());
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const radius = Math.max(sphere.radius, 1e-6);

      controls.target.copy(target);
      const distance = Math.max(radius * 2.8, 1);
      camera.position.set(target.x, target.y, target.z + distance);

      // Keep clipping planes proportional to data scale to avoid clipped or invisible clouds.
      camera.near = Math.max(radius / 200, 0.001);
      camera.far = Math.max(radius * 100, 1000);

      camera.updateProjectionMatrix();
    };

    if (!savedView) {
      fitToObject();
    }

    measurementPlaneYRef.current = controls.target.y;

    camera.fov = fieldOfView;
    camera.updateProjectionMatrix();

    const measurementCanvas = measurementCanvasRef.current;
    const measurementCtx = measurementCanvas?.getContext("2d");

    const resizeMeasurementCanvas = () => {
      if (!measurementCanvas) return;
      measurementCanvas.width = container.clientWidth;
      measurementCanvas.height = container.clientHeight;
    };

    resizeMeasurementCanvas();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const worldPointToScreen = (point: MeasurementPoint) => {
      const projected = new THREE.Vector3(point.x, point.y, point.z).project(camera);
      return {
        x: (projected.x * 0.5 + 0.5) * container.clientWidth,
        y: (-projected.y * 0.5 + 0.5) * container.clientHeight,
      };
    };

    const drawLabel = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string) => {
      ctx.font = "12px sans-serif";
      const paddingX = 6;
      const metrics = ctx.measureText(text);
      const boxWidth = metrics.width + paddingX * 2;
      const boxHeight = 18;
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, x - metrics.width / 2, y + 4);
    };

    const drawMeasurementOverlay = () => {
      if (!measurementCtx || !measurementCanvas) return;

      const settings = viewerSettingsRef.current;
      if (!settings.showMeasurements) {
        measurementCtx.clearRect(0, 0, measurementCanvas.width, measurementCanvas.height);
        return;
      }

      const width = measurementCanvas.width;
      const height = measurementCanvas.height;
      measurementCtx.clearRect(0, 0, width, height);

      const strokeColor = "#f97316";
      const pointColor = "#ffffff";

      const drawPolyline = (points: MeasurementPoint[], closePath = false) => {
        if (points.length === 0) return;

        const screenPoints = points.map(worldPointToScreen);

        measurementCtx.strokeStyle = strokeColor;
        measurementCtx.fillStyle = pointColor;
        measurementCtx.lineWidth = 2;
        measurementCtx.beginPath();
        screenPoints.forEach((screenPoint, index) => {
          if (index === 0) {
            measurementCtx.moveTo(screenPoint.x, screenPoint.y);
          } else {
            measurementCtx.lineTo(screenPoint.x, screenPoint.y);
          }
        });
        if (closePath && screenPoints.length > 2) {
          measurementCtx.lineTo(screenPoints[0]!.x, screenPoints[0]!.y);
        }
        measurementCtx.stroke();

        screenPoints.forEach((screenPoint) => {
          measurementCtx.beginPath();
          measurementCtx.arc(screenPoint.x, screenPoint.y, 4, 0, Math.PI * 2);
          measurementCtx.fill();
        });

        return screenPoints;
      };

      if (settings.distancePoints.length === 1) {
        drawPolyline(settings.distancePoints, false);
      }

      if (settings.distancePoints.length === 2) {
        const screenPoints = drawPolyline(settings.distancePoints, false);
        if (screenPoints && screenPoints.length === 2) {
          const [startPoint, endPoint] = screenPoints;
          const midX = (startPoint.x + endPoint.x) / 2;
          const midY = (startPoint.y + endPoint.y) / 2;
          drawLabel(measurementCtx, midX, midY - 14, `${distanceBetweenPoints(settings.distancePoints[0]!, settings.distancePoints[1]!).toFixed(2)} m`);
        }
      }

      if (settings.areaPoints.length > 0) {
        const screenPoints = drawPolyline(settings.areaPoints, settings.areaPoints.length >= 3);
        if (screenPoints && screenPoints.length >= 2) {
          for (let index = 0; index < settings.areaPoints.length; index += 1) {
            const current = settings.areaPoints[index];
            const next = settings.areaPoints[(index + 1) % settings.areaPoints.length];
            if (!current || !next) continue;

            const start = screenPoints[index]!;
            const end = screenPoints[(index + 1) % screenPoints.length]!;
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            drawLabel(measurementCtx, midX, midY - 12, `${distanceBetweenPoints(current, next).toFixed(2)} m`);
          }
        }

        if (settings.areaPoints.length >= 3) {
          const areaLabel = `${polygonAreaFromPoints(settings.areaPoints).toFixed(2)} m┬▓`;
          const centroid = settings.areaPoints.reduce(
            (accumulator, point) => ({
              x: accumulator.x + point.x,
              y: accumulator.y + point.y,
              z: accumulator.z + point.z,
            }),
            { x: 0, y: 0, z: 0 }
          );
          centroid.x /= settings.areaPoints.length;
          centroid.y /= settings.areaPoints.length;
          centroid.z /= settings.areaPoints.length;
          const centroidScreen = worldPointToScreen(centroid);
          drawLabel(measurementCtx, centroidScreen.x, centroidScreen.y, areaLabel);
        }
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const settings = viewerSettingsRef.current;
      if (dataType !== "3d" || !settings.measurementTool) return;
      if (event.button !== 0) return;

      const rect = container.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);

      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -measurementPlaneYRef.current);
      const intersection = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, intersection)) return;

      const point: MeasurementPoint = { x: intersection.x, y: intersection.y, z: intersection.z };

      if (settings.measurementTool === "distance") {
        setDistancePoints((previousPoints) => {
          if (previousPoints.length >= 2) {
            return [point];
          }

          return [...previousPoints, point];
        });
      }

      if (settings.measurementTool === "area") {
        setAreaPoints((previousPoints) => [...previousPoints, point]);
      }
    };

    const removeClosestPointAtScreenPosition = (clientX: number, clientY: number) => {
      const settings = viewerSettingsRef.current;
      if (!settings.measurementTool) return;

      const rect = container.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;
      const maxDistancePx = 12;
      const maxDistanceSq = maxDistancePx * maxDistancePx;

      const points = settings.measurementTool === "distance" ? settings.distancePoints : settings.areaPoints;
      if (points.length === 0) return;

      let nearestIndex = -1;
      let nearestDistanceSq = Number.POSITIVE_INFINITY;

      points.forEach((point, index) => {
        const screenPoint = worldPointToScreen(point);
        const dx = screenPoint.x - clickX;
        const dy = screenPoint.y - clickY;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq <= maxDistanceSq && distanceSq < nearestDistanceSq) {
          nearestDistanceSq = distanceSq;
          nearestIndex = index;
        }
      });

      if (nearestIndex < 0) return;

      if (settings.measurementTool === "distance") {
        setDistancePoints((previousPoints) => previousPoints.filter((_, index) => index !== nearestIndex));
      } else {
        setAreaPoints((previousPoints) => previousPoints.filter((_, index) => index !== nearestIndex));
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      const settings = viewerSettingsRef.current;
      if (dataType !== "3d" || !settings.measurementTool) return;

      event.preventDefault();
      removeClosestPointAtScreenPosition(event.clientX, event.clientY);
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("contextmenu", handleContextMenu);

    const handleResize = () => {
      const width = container.clientWidth;
      const height = Math.max(container.clientHeight, 1);
      const nextAspect = width / height;

      renderer.setSize(width, height);
      resizeMeasurementCanvas();

      camera.aspect = nextAspect;

      camera.updateProjectionMatrix();
    };

    const animate = () => {
      controls.update();

      renderer.render(scene, camera);
      drawMeasurementOverlay();
      animationFrame = window.requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(container);
    window.addEventListener("resize", handleResize);
    animate();

    return () => {
      cancelCameraTransition();

      saved3DViewStateRef.current = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        quaternion: [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w],
        target: [controls.target.x, controls.target.y, controls.target.z],
        zoom: camera.zoom,
      };

      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("contextmenu", handleContextMenu);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.cancelAnimationFrame(animationFrame);
      controls.dispose();

      if (activeCameraRef.current === camera) {
        activeCameraRef.current = null;
      }
      if (activeControlsRef.current === controls) {
        activeControlsRef.current = null;
      }

      scene.traverse((object: THREE.Object3D) => {
        if (object.userData?.keepLiveReference) return;
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) return;

        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material: THREE.Material) => material.dispose());
        } else {
          object.material.dispose();
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [dataType, plyGeometry, sceneObject, effective3DViewMode]);

  useEffect(() => {
    const camera = activeCameraRef.current;
    if (!camera) return;

    camera.fov = fieldOfView;
    camera.updateProjectionMatrix();
  }, [fieldOfView]);

  useEffect(() => {
    if (!isViewerFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsViewerFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isViewerFullscreen]);

  const loadPlyFromFile = (file: File) => {
    setIsLoadingPly(true);
    setPlyError("");
    setStatus("Loading .ply file...");

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result;
        if (!(buffer instanceof ArrayBuffer)) {
          throw new Error("Unsupported file data");
        }

        const geometry = plyLoader.parse(buffer);

        if (!geometry.getAttribute("position")) {
          throw new Error("No vertex positions found in PLY file.");
        }

        swapYAndZInGeometry(geometry);

        geometry.computeVertexNormals();
        const positions = geometry.getAttribute("position");

        setPlyGeometry(geometry);
        setSceneObject(null);
        resetSaved3DViewStates();
        autoCapturedProjectIconIdRef.current = null;
        setMeasurementTool(null);
        setDistancePoints([]);
        setAreaPoints([]);
        setViewMode("pointcloud");
        setPlyName(file.name);
        setLoadedFilePath((file as File & { path?: string }).path || file.name);
        setPointCount(positions.count);
        setStatus("Loaded successfully");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Cannot parse this PLY file.";
        setPlyError(message);
        setStatus(message);
      } finally {
        setIsLoadingPly(false);
      }
    };

    reader.onerror = () => {
      const message = "Cannot read the selected file.";
      setPlyError(message);
      setStatus(message);
      setIsLoadingPly(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const loadPlyFromPath = async (filePath: string) => {
    if (!hasElectronApi()) {
      const message = 'Electron bridge is unavailable. Start with "npm run dev".';
      setPlyError(message);
      setStatus(message);
      return;
    }

    try {
      setIsLoadingPly(true);
      setPlyError("");
      setStatus("Loading .ply file...");

      const arrayBuffer = await window.electronAPI.readPlyFile(filePath);
      const geometry = plyLoader.parse(arrayBuffer);

      if (!geometry.getAttribute("position")) {
        throw new Error("The selected PLY file does not contain point positions.");
      }

      swapYAndZInGeometry(geometry);

      geometry.computeVertexNormals();
      const positions = geometry.getAttribute("position");

      setPlyGeometry(geometry);
      setSceneObject(null);
      resetSaved3DViewStates();
      autoCapturedProjectIconIdRef.current = null;
      setMeasurementTool(null);
      setDistancePoints([]);
      setAreaPoints([]);
      setViewMode("pointcloud");
      setPointCount(positions.count);
      setStatus("Loaded successfully");

      const chunks = filePath.split(/[\\/]/);
      setPlyName(chunks[chunks.length - 1] || filePath);
      setLoadedFilePath(filePath);
      updateProjectRootPath(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load the .ply file.";
      setPlyError(message);
      setStatus(message);
    } finally {
      setIsLoadingPly(false);
    }
  };

  const joinPath = (basePath: string, child: string) => {
    const normalizedBase = basePath.replace(/[\\/]+$/, "");
    return `${normalizedBase}\\${child}`;
  };

  type DirectoryEntry = {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    type: string;
  };

  const readDirectoryEntries = async (dirPath: string): Promise<DirectoryEntry[]> => {
    if (!hasElectronApi()) return [];

    const payload = await window.electronAPI.readDirectory(dirPath);

    if (
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      "error" in payload
    ) {
      return [];
    }

    if (!Array.isArray(payload)) {
      return [];
    }

    return payload as DirectoryEntry[];
  };

  const findPointCloudPly = async (projectRootPath: string): Promise<string | null> => {
    const directFolderPath = joinPath(projectRootPath, "odm_filterpoints");
    const directEntries = await readDirectoryEntries(directFolderPath);
    const directPly = directEntries.find(
      (entry) => !entry.isDirectory && entry.name.toLowerCase() === "point_cloud.ply"
    );
    if (directPly) return directPly.path;

    const maxDepth = 6;
    const queue: Array<{ path: string; depth: number }> = [{ path: projectRootPath, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const entries = await readDirectoryEntries(current.path);

      for (const entry of entries) {
        if (entry.isDirectory) {
          const isFilterPoints = entry.name.toLowerCase() === "odm_filterpoints";
          if (isFilterPoints) {
            const filterEntries = await readDirectoryEntries(entry.path);
            const pointCloud = filterEntries.find(
              (candidate) => !candidate.isDirectory && candidate.name.toLowerCase() === "point_cloud.ply"
            );
            if (pointCloud) return pointCloud.path;
          }

          if (current.depth < maxDepth) {
            queue.push({ path: entry.path, depth: current.depth + 1 });
          }
        }
      }
    }

    return null;
  };

  const getFileNameFromPath = (filePath: string) => {
    const parts = filePath.split(/[\\/]/);
    return parts[parts.length - 1] || filePath;
  };

  const findOrthophotoArtifacts = async (
    projectRootPath: string
  ): Promise<{ tifPath: string; tfwPath: string; dxfPath: string } | null> => {
    const pickArtifactsFromEntries = (entries: DirectoryEntry[]) => {
      const tifEntry =
        entries.find((entry) => !entry.isDirectory && entry.name.toLowerCase() === "odm_orthophoto.tif") ||
        entries.find((entry) => !entry.isDirectory && entry.name.toLowerCase() === "odm_orthophoto.tiff");
      const tfwEntry = entries.find(
        (entry) => !entry.isDirectory && entry.name.toLowerCase() === "odm_orthophoto.tfw"
      );
      const dxfEntry = entries.find(
        (entry) => !entry.isDirectory && entry.name.toLowerCase() === "odm_orthophoto_extent.dxf"
      );

      if (tifEntry && tfwEntry && dxfEntry) {
        return {
          tifPath: tifEntry.path,
          tfwPath: tfwEntry.path,
          dxfPath: dxfEntry.path,
        };
      }

      return null;
    };

    const directFolderPath = joinPath(projectRootPath, "odm_orthophoto");
    const directEntries = await readDirectoryEntries(directFolderPath);
    const directMatch = pickArtifactsFromEntries(directEntries);
    if (directMatch) {
      return directMatch;
    }

    const maxDepth = 6;
    const queue: Array<{ path: string; depth: number }> = [{ path: projectRootPath, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const entries = await readDirectoryEntries(current.path);
      for (const entry of entries) {
        if (entry.isDirectory) {
          if (entry.name.toLowerCase() === "odm_orthophoto") {
            const orthophotoEntries = await readDirectoryEntries(entry.path);
            const match = pickArtifactsFromEntries(orthophotoEntries);
            if (match) {
              return match;
            }
          }

          if (current.depth < maxDepth) {
            queue.push({ path: entry.path, depth: current.depth + 1 });
          }
        }
      }
    }

    return null;
  };

  const createFileFromPath = async (filePath: string): Promise<File> => {
    if (!hasElectronApi()) {
      throw new Error('Electron bridge is unavailable. Start with "npm run dev".');
    }

    const extension = filePath.split(".").pop()?.toLowerCase() || "";
    const name = getFileNameFromPath(filePath);

    if (extension === "tfw" || extension === "dxf" || extension === "prj") {
      const text = await window.electronAPI.readFileText(filePath);
      return new File([text], name, { type: "text/plain" });
    }

    const binary = await window.electronAPI.readFileBinary(filePath);
    const mimeType = extension === "tif" || extension === "tiff" ? "image/tiff" : "application/octet-stream";
    return new File([binary], name, { type: mimeType });
  };

  const createOrthophotoBasemapLayer = async (
    basemapId: keyof typeof ORTHOPHOTO_BASEMAPS,
    constrainedBounds: L.LatLngBounds
  ): Promise<L.Layer> => {
    const selectedBasemap = ORTHOPHOTO_BASEMAPS[basemapId] || ORTHOPHOTO_BASEMAPS.satellite;

    if (selectedBasemap.kind === "google") {
      if (!ENABLE_GOOGLE_BASEMAP) {
        throw new Error(
          "Google basemap is disabled. Enable it with VITE_ENABLE_GOOGLE_BASEMAP=true after activating Maps JavaScript API in Google Cloud."
        );
      }

      await ensureGoogleMapsLoaded();

      return new GoogleMutant({
        type: selectedBasemap.googleType,
        noWrap: true,
        bounds: constrainedBounds,
        keepBuffer: 1,
        updateWhenIdle: true,
        ...selectedBasemap.options,
      });
    }

    return L.tileLayer(selectedBasemap.url, {
      ...selectedBasemap.options,
      bounds: constrainedBounds,
      noWrap: true,
      keepBuffer: 1,
      updateWhenIdle: true,
    });
  };

  const createHillshadeLayer = (bounds: L.LatLngBounds) => {
    const hillshadeLayer = L.tileLayer(ORTHOPHOTO_HILLSHADE.url, {
      ...ORTHOPHOTO_HILLSHADE.options,
      bounds,
      noWrap: true,
      keepBuffer: 1,
      updateWhenIdle: true,
    });

    hillshadeLayer.once("tileerror", () => {
      const map = orthophotoMapRef.current;
      if (map && map.hasLayer(hillshadeLayer)) {
        map.removeLayer(hillshadeLayer);
      }

      orthophotoHillshadeLayerRef.current = null;
      setShowOrthophotoHillshade(false);
      setOrthophotoStatus("Hillshade provider is unreachable. Overlay disabled.");
    });

    return hillshadeLayer;
  };

  const getProjectDataForViewer = async (userId: string, routeProjectId: string) => {
    const projectsRef = collection(db, "Users", userId, "Projects");
    const projectByFieldQuery = query(projectsRef, where("projectId", "==", routeProjectId), limit(1));
    const projectByFieldSnapshot = await getDocs(projectByFieldQuery);

    if (!projectByFieldSnapshot.empty) {
      return projectByFieldSnapshot.docs[0].data() as {
        projectPath?: string;
        basePath?: string;
      };
    }

    // Fallback for records where route uses document id instead of projectId field.
    const projectByDocRef = doc(db, "Users", userId, "Projects", routeProjectId);
    const projectByDocSnapshot = await getDoc(projectByDocRef);
    if (projectByDocSnapshot.exists()) {
      return projectByDocSnapshot.data() as {
        projectPath?: string;
        basePath?: string;
      };
    }

    return null;
  };

  useEffect(() => {
    const autoLoadProjectPointCloud = async () => {
      if (dataType !== "3d") return;
      if (!projectId || projectId.trim().length === 0) return;
      if (lastAutoLoadedProjectIdRef.current === projectId && (plyGeometry || sceneObject)) return;
      if (!viewerUserId) return;

      try {
        setIsLoadingPly(true);
        setPlyError("");

        const projectData = await getProjectDataForViewer(viewerUserId, projectId);
        if (!projectData) {
          setPlyError("Project not found.");
          setStatus("Project not found.");
          return;
        }

        const projectRootPath = (projectData.projectPath || projectData.basePath || "").trim();
        if (!projectRootPath) {
          setPlyError("Project output path is not set.");
          setStatus("Project output path is not set.");
          return;
        }

        setCurrentProjectRootPath(projectRootPath);

        const plyPath = await findPointCloudPly(projectRootPath);

        if (!plyPath) {
          setPlyError("Could not find odm_filterpoints/point_cloud.ply in this project.");
          setStatus("Could not find odm_filterpoints/point_cloud.ply in this project.");
          return;
        }

        await loadPlyFromPath(plyPath);
        lastAutoLoadedProjectIdRef.current = projectId;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to auto-load point cloud.";
        setPlyError(message);
        setStatus(message);
      } finally {
        setIsLoadingPly(false);
      }
    };

    void autoLoadProjectPointCloud();
  }, [dataType, projectId, viewerUserId, plyGeometry, sceneObject]);

  useEffect(() => {
    const autoLoadProjectOrthophoto = async () => {
      if (dataType !== "orthophoto") return;
      if (!projectId || projectId.trim().length === 0) return;
      if (!hasElectronApi()) {
        setOrthophotoStatus('Electron bridge is unavailable. Start with "npm run dev".');
        return;
      }
      if (!viewerUserId) return;

      // If already loaded for this project, re-attach and reflow instead of re-importing.
      if (lastAutoLoadedOrthophotoProjectIdRef.current === projectId && orthophotoRasterLayerRef.current) {
        const map = orthophotoMapRef.current;
        if (map && orthophotoLayerControls.raster.visible && !map.hasLayer(orthophotoRasterLayerRef.current)) {
          orthophotoRasterLayerRef.current.addTo(map);
        }

        if (map) {
          map.invalidateSize();
          const bounds = orthophotoDataBoundsRef.current;
          if (bounds?.isValid()) {
            map.fitBounds(bounds, { padding: [20, 20] });
          }
        }
        return;
      }

      try {
        setIsOrthophotoBusy(true);
        setOrthophotoStatus("Looking for ODM orthophoto files...");

        const projectData = await getProjectDataForViewer(viewerUserId, projectId);
        if (!projectData) {
          setOrthophotoStatus("Error: Project not found.");
          return;
        }

        const projectRootPath = (projectData.projectPath || projectData.basePath || "").trim();
        if (!projectRootPath) {
          setOrthophotoStatus("Error: Project output path is not set.");
          return;
        }

        setCurrentProjectRootPath(projectRootPath);

        const artifacts = await findOrthophotoArtifacts(projectRootPath);
        if (!artifacts) {
          setOrthophotoStatus(
            "Error: Could not find odm_orthophoto/odm_orthophoto.tif + odm_orthophoto.tfw + odm_orthophoto_extent.dxf."
          );
          return;
        }

        const files = await Promise.all([
          createFileFromPath(artifacts.tifPath),
          createFileFromPath(artifacts.tfwPath),
          createFileFromPath(artifacts.dxfPath),
        ]);

        lastSelectedOrthophotoFilesRef.current = files;
        const success = await processOrthophotoFiles(files);

        if (success) {
          lastAutoLoadedOrthophotoProjectIdRef.current = projectId;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to auto-load orthophoto.";
        setOrthophotoStatus(`Error: ${message}`);
      } finally {
        setIsOrthophotoBusy(false);
      }
    };

    void autoLoadProjectOrthophoto();
  }, [dataType, projectId, viewerUserId, orthophotoLayerControls.raster.visible]);

  useEffect(() => {
    if (dataType !== "3d") return;
    if (!projectId || projectId.trim().length === 0) return;
    if (autoCapturedProjectIconIdRef.current === projectId) return;
    if (isLoadingPly) return;
    if (!plyGeometry && !sceneObject) return;

    let canceled = false;

    const captureTopViewAsProjectIcon = async (attempt = 0): Promise<void> => {
      if (canceled) return;

      const currentUser = auth.currentUser;
      if (!currentUser?.uid || !hasElectronApi()) return;

      const rendererCanvas = threeContainerRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
      const camera = activeCameraRef.current;
      const controls = activeControlsRef.current;

      const projectRootPath = currentProjectRootPath || (loadedFilePath ? deriveProjectRootPathFromPlyPath(loadedFilePath) : "");

      if (!rendererCanvas || !camera || !controls || !projectRootPath) {
        if (attempt < 10) {
          window.setTimeout(() => {
            void captureTopViewAsProjectIcon(attempt + 1);
          }, 150);
        }
        return;
      }

      const previousView = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        up: camera.up.clone(),
        zoom: camera.zoom,
        target: controls.target.clone(),
      };

      try {
        const distance = Math.max(camera.position.distanceTo(controls.target), 1);
        camera.up.set(0, 0, -1);
        camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(0, 1, 0), distance);
        camera.lookAt(controls.target);
        camera.updateProjectionMatrix();
        controls.update();

        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
          });
        });

        const iconPath = joinPath(projectRootPath, "project-icon.png");
        const dataUrl = rendererCanvas.toDataURL("image/png");
        await window.electronAPI.saveScreenshot({ filePath: iconPath, dataUrl });

        const projectsRef = collection(db, "Users", currentUser.uid, "Projects");
        const projectQuery = query(projectsRef, where("projectId", "==", projectId), limit(1));
        const projectSnapshot = await getDocs(projectQuery);

        if (!projectSnapshot.empty) {
          await setDoc(
            projectSnapshot.docs[0].ref,
            {
              projectIconPath: iconPath,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        autoCapturedProjectIconIdRef.current = projectId;
      } catch (error) {
        console.error("Failed to auto-capture project icon", error);
      } finally {
        camera.position.copy(previousView.position);
        camera.quaternion.copy(previousView.quaternion);
        camera.up.copy(previousView.up);
        camera.zoom = previousView.zoom;
        controls.target.copy(previousView.target);
        camera.updateProjectionMatrix();
        controls.update();

        saved3DViewStateRef.current = {
          position: [camera.position.x, camera.position.y, camera.position.z],
          quaternion: [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w],
          target: [controls.target.x, controls.target.y, controls.target.z],
          zoom: camera.zoom,
        };
      }
    };

    void captureTopViewAsProjectIcon();

    return () => {
      canceled = true;
    };
  }, [dataType, projectId, isLoadingPly, currentProjectRootPath, loadedFilePath, plyGeometry, sceneObject]);

  const loadObjFromFile = (file: File) => {
    setIsLoadingPly(true);
    setPlyError("");

    const objectUrl = URL.createObjectURL(file);
    const loader = new OBJLoader();

    loader.load(
      objectUrl,
      (object) => {
        setSceneObject(object);
        setPlyGeometry(null);
        resetSaved3DViewStates();
        autoCapturedProjectIconIdRef.current = null;
        setMeasurementTool(null);
        setDistancePoints([]);
        setAreaPoints([]);
        setPlyName(file.name);
        setLoadedFilePath((file as File & { path?: string }).path || file.name);
        setIsLoadingPly(false);
        URL.revokeObjectURL(objectUrl);
      },
      undefined,
      (error) => {
        setPlyError(error instanceof Error ? error.message : "Cannot load this OBJ file.");
        setIsLoadingPly(false);
        URL.revokeObjectURL(objectUrl);
      }
    );
  };

  const loadGltfFromFile = (file: File) => {
    setIsLoadingPly(true);
    setPlyError("");

    const objectUrl = URL.createObjectURL(file);
    const loader = new GLTFLoader();

    loader.load(
      objectUrl,
      (gltf) => {
        setSceneObject(gltf.scene);
        setPlyGeometry(null);
        resetSaved3DViewStates();
        autoCapturedProjectIconIdRef.current = null;
        setMeasurementTool(null);
        setDistancePoints([]);
        setAreaPoints([]);
        setPlyName(file.name);
        setLoadedFilePath((file as File & { path?: string }).path || file.name);
        setIsLoadingPly(false);
        URL.revokeObjectURL(objectUrl);
      },
      undefined,
      (error) => {
        setPlyError(error instanceof Error ? error.message : "Cannot load this GLTF/GLB file.");
        setIsLoadingPly(false);
        URL.revokeObjectURL(objectUrl);
      }
    );
  };

  const loadRasterFromFile = (file: File) => {
    setIsLoadingPly(true);
    setPlyError("");

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      rasterImageRef.current = image;
      setRasterName(file.name);
      setRasterRevision((value) => value + 1);
      setIsLoadingPly(false);
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      setPlyError("This image format is not supported for preview.");
      setIsLoadingPly(false);
      URL.revokeObjectURL(objectUrl);
    };

    image.src = objectUrl;
  };

  const processOrthophotoFiles = async (files: File[], forcedSourceCrs: string | null = null) => {
    setIsOrthophotoBusy(true);
    setOrthophotoStatus("Reading image georeferencing and preparing a PNG overlay preview...");

    try {
      const tfwFile = files.find((file) => file.name.toLowerCase().endsWith(".tfw"));
      const tfwBasename = tfwFile ? getFileBasename(tfwFile.name) : null;
      const prjCandidate =
        (tfwBasename ? findCompanionFile(files, tfwBasename, [".prj"]) : null) ||
        files.find((file) => file.name.toLowerCase().endsWith(".prj"));

      const imageCandidates = files.filter((file) => /\.(png|jpg|jpeg|webp|tif|tiff)$/i.test(file.name));
      let companionImage =
        (tfwBasename
          ? findCompanionFile(files, tfwBasename, [".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"])
          : null) || null;

      if (!companionImage && imageCandidates.length === 1) {
        companionImage = imageCandidates[0]!;
      }

      if (!companionImage) {
        const candidateNames = imageCandidates.map((file) => file.name).join(", ");
        throw new Error(
          tfwFile && imageCandidates.length > 1
            ? `No image matches ${tfwFile.name}. Select matching names (for example map.tfw with map.tif). Found images: ${candidateNames}.`
            : "Companion raster image not found. Include matching .tif/.tiff/.png/.jpg/.jpeg/.webp with the .tfw."
        );
      }

      let sourceCrs = normalizeCrs(forcedSourceCrs ?? orthophotoSourceCrsInput);
      let prjDetectedCrs: string | null = null;

      if (prjCandidate) {
        const prjText = await prjCandidate.text();
        prjDetectedCrs = inferEpsgFromPrjText(prjText);

        if (prjDetectedCrs && normalizeCrs(forcedSourceCrs ?? orthophotoSourceCrsInput).toUpperCase() === "EPSG:32632") {
          sourceCrs = prjDetectedCrs;
        }
      }

      const dxfFiles = files.filter((file) => file.name.toLowerCase().endsWith(".dxf"));
      const { width, height, url, georef } = await loadCompanionImage(companionImage);

      let georeferenceSource: "tfw" | "tiff-metadata" = "tfw";
      let coefficients: number[] | null = null;
      let rawCorners: GeoPoint[] | null = null;

      if (georef && georef.rawCorners.length === 4) {
        georeferenceSource = "tiff-metadata";
        rawCorners = georef.rawCorners;

        if (georef.sourceCrs && normalizeCrs(forcedSourceCrs ?? orthophotoSourceCrsInput).toUpperCase() === "EPSG:32632") {
          sourceCrs = georef.sourceCrs;
        }
      } else {
        if (!tfwFile) {
          throw new Error("No embedded TIFF georeferencing found. Add matching .tfw (and optional .prj) file.");
        }

        const tfwText = await tfwFile.text();
        coefficients = parseTfw(tfwText);
        rawCorners = [
          applyWorldFileTransform(coefficients, -0.5, -0.5),
          applyWorldFileTransform(coefficients, width - 0.5, -0.5),
          applyWorldFileTransform(coefficients, width - 0.5, height - 0.5),
          applyWorldFileTransform(coefficients, -0.5, height - 0.5),
        ];
      }

      lastOrthophotoRawCornersRef.current = rawCorners;
      const cornersLonLat = transformCornersToLonLat(rawCorners, sourceCrs);
      const lonLatBounds = boundsFromCorners(cornersLonLat);
      if (!validateWgs84Bounds(lonLatBounds)) {
        throw new Error(
          `Computed bounds are outside WGS84: lon ${lonLatBounds.minX.toFixed(6)}..${lonLatBounds.maxX.toFixed(6)}, lat ${lonLatBounds.minY.toFixed(6)}..${lonLatBounds.maxY.toFixed(6)}. Set the correct Source CRS (or include matching .prj).`
        );
      }

      const minLon = Math.min(...cornersLonLat.map((corner) => corner.x));
      const maxLon = Math.max(...cornersLonLat.map((corner) => corner.x));
      const minLat = Math.min(...cornersLonLat.map((corner) => corner.y));
      const maxLat = Math.max(...cornersLonLat.map((corner) => corner.y));

      const map = orthophotoMapRef.current;
      if (!map) {
        throw new Error("Map failed to initialize.");
      }

      const previousRasterControls = orthophotoLayerControls.raster;
      if (orthophotoRasterLayerRef.current) {
        map.removeLayer(orthophotoRasterLayerRef.current);
      }

      if (orthophotoRasterUrlRef.current && orthophotoRasterUrlRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(orthophotoRasterUrlRef.current);
      }
      orthophotoRasterUrlRef.current = url;

      for (const layer of Object.values(orthophotoDxfLayerRefs.current)) {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      }

      orthophotoDxfLayerRefs.current = {};

      const rasterLayer = L.imageOverlay(
        url,
        [
          [minLat, minLon],
          [maxLat, maxLon],
        ],
        { opacity: previousRasterControls.opacity }
      );

      const rasterBounds = L.latLngBounds(
        [minLat, minLon],
        [maxLat, maxLon]
      );
      orthophotoDataBoundsRef.current = rasterBounds;
      map.setMaxBounds(rasterBounds.pad(0.05));
      map.options.maxBoundsViscosity = 1;

      if (previousRasterControls.visible) {
        rasterLayer.addTo(map);
      }
      orthophotoRasterLayerRef.current = rasterLayer;

      setRasterName(companionImage.name);
      setRasterRevision((value) => value + 1);

      const dxfControlEntries: OrthophotoLayerControl[] = [];

      if (dxfFiles.length > 0) {
        for (const dxfFile of dxfFiles) {
          const dxfText = await dxfFile.text();
          const rendered = renderDxfToLayer(dxfText, sourceCrs);

          orthophotoDxfLayerRefs.current[dxfFile.name] = rendered.layer;
          rendered.layer.addTo(map);
          setVectorLayerOpacity(rendered.layer, 0.9);

          dxfControlEntries.push({
            name: dxfFile.name,
            visible: true,
            opacity: 0.9,
          });
        }
      }

      setOrthophotoLayerControls({
        raster: previousRasterControls,
        dxf: dxfControlEntries,
      });

      const fitGroup = L.featureGroup([rasterLayer]);
      for (const dxfLayer of Object.values(orthophotoDxfLayerRefs.current)) {
        fitGroup.addLayer(dxfLayer);
      }

      const bounds = fitGroup.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }

      if (orthophotoBasemapLayerRef.current) {
        map.removeLayer(orthophotoBasemapLayerRef.current);
      }
      orthophotoBasemapLayerRef.current = await createOrthophotoBasemapLayer(orthophotoBasemapId, rasterBounds);
      orthophotoBasemapLayerRef.current.addTo(map);

      if (orthophotoHillshadeLayerRef.current) {
        map.removeLayer(orthophotoHillshadeLayerRef.current);
        orthophotoHillshadeLayerRef.current = null;
      }
      if (showOrthophotoHillshade) {
        orthophotoHillshadeLayerRef.current = createHillshadeLayer(rasterBounds);
        orthophotoHillshadeLayerRef.current.addTo(map);
      }

      setOrthophotoStatus(
        dxfFiles.length > 0
              ? `${georeferenceSource === "tiff-metadata" ? "TIFF-metadata" : "TFW"} raster (PNG preview) and DXF vectors rendered in real-world position.`
              : `${georeferenceSource === "tiff-metadata" ? "TIFF-metadata" : "TFW"}-referenced raster (PNG preview) rendered in real-world position.`
      );
      return true;
    } catch (error) {
      setOrthophotoStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsOrthophotoBusy(false);
    }
  };

  const importFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";

    if (dataType === "3d") {
      if (extension === "ply") {
        loadPlyFromFile(file);
        return;
      }

      if (extension === "obj") {
        loadObjFromFile(file);
        return;
      }

      if (extension === "glb" || extension === "gltf") {
        loadGltfFromFile(file);
        return;
      }

      setPlyError("Unsupported 3D format. Use .ply, .obj, .glb or .gltf");
      setStatus("Unsupported 3D format. Use .ply, .obj, .glb or .gltf");
      return;
    }

    if (dataType === "orthophoto") {
      void processOrthophotoFiles([file]);
      return;
    }

    loadRasterFromFile(file);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragDepthRef.current = 0;
    setIsDragActive(false);

    if (dataType === "orthophoto") {
      const files = Array.from(event.dataTransfer.files || []);
      if (files.length === 0) return;
      lastSelectedOrthophotoFilesRef.current = files;
      void processOrthophotoFiles(files);
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const droppedPath = (file as File & { path?: string }).path;

    if (dataType === "3d" && extension === "ply" && droppedPath) {
      void loadPlyFromPath(droppedPath);
      return;
    }

    importFile(file);
  };

  const shouldShowOpenProjectPrompt =
    !projectId &&
    !loadedFilePath &&
    !plyGeometry &&
    !sceneObject &&
    !isLoadingPly &&
    dataType === "3d";

  if (shouldShowOpenProjectPrompt) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#0a0e14] p-6">
        <div className="max-w-md w-full rounded-xl border border-border bg-card/95 p-8 text-center shadow-xl">
          <h2 className="text-xl font-semibold mb-2">Open a project first</h2>
          <p className="text-sm text-muted-foreground mb-6">
            You need to open a project before accessing the viewer.
          </p>
          <button
            type="button"
            onClick={() => navigate("/openproject")}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            Go to Open Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex ${isViewerFullscreen ? "fixed inset-0 z-50 bg-[#0a0e14]" : ""}`}>
      {/* Main Viewer - Fixed */}
      <div
        className={`flex flex-col relative isolate bg-[#0a0e14] ${isViewerFullscreen ? "w-full h-full" : "flex-1"}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-30 flex gap-2">
          {dataType === "3d" && (
            <>
              <Tabs.Root value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)}>
                <Tabs.List className="flex bg-card border border-border rounded-lg p-1">
                  <Tabs.Trigger
                    value="pointcloud"
                    className="px-4 py-2 text-sm rounded transition-colors data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    Point Cloud
                  </Tabs.Trigger>
                </Tabs.List>
              </Tabs.Root>

              <div className="flex bg-card border border-border rounded-lg p-1">
                <IconButton
                  icon={Grid3x3}
                  active={wireframe}
                  onClick={() => setWireframe(!wireframe)}
                  tooltip="Wireframe"
                />
                <IconButton
                  icon={Lightbulb}
                  active={lighting}
                  onClick={() => setLighting(!lighting)}
                  tooltip="Lighting"
                />
                <IconButton
                  icon={RotateCcw}
                  onClick={() => {
                    setDataType("3d");
                    setViewMode("pointcloud");
                    setWireframe(false);
                    setShowGrid(true);
                    setLighting(true);
                    setShowAxes(true);
                    setShowShadows(false);
                    setAmbientOcclusion(false);
                    setShowMeasurements(false);
                    setBackgroundColor("#071126");
                    setRenderQuality("high");
                    setPointSize(0.02);
                    setColorMode("rgb");
                    setMeshOpacity(100);
                    setMeasurementTool(null);
                    setDistancePoints([]);
                    setAreaPoints([]);
                  }}
                  tooltip="Reset View"
                />
              </div>
            </>
          )}
        </div>

        {/* View Controls */}
        {dataType === "3d" && (
          <div className="absolute top-4 right-4 z-30">
            <div className="bg-card border border-border rounded-lg p-1">
              <ViewCube onSelectView={setPresetView} />
            </div>
          </div>
        )}

        {isViewerFullscreen && (
          <div className="absolute bottom-4 right-4 z-50">
            <button
              type="button"
              onClick={() => setIsViewerFullscreen(false)}
              className="rounded-lg border border-border bg-card/95 px-4 py-2 text-sm shadow-lg hover:bg-accent"
            >
              Exit Fullscreen
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="absolute bottom-20 left-4 z-30 bg-card/90 backdrop-blur border border-border rounded-lg px-4 py-2">
          <div className="flex items-center gap-6 text-xs">
            {dataType === "3d" ? (
              <>
                <div>
                  <span className="text-muted-foreground">Vertices: </span>
                  <span>{pointCount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">File: </span>
                  <span>{plyName}</span>
                </div>
                <div className="max-w-[320px] truncate" title={loadedFilePath}>
                  <span className="text-muted-foreground">Path: </span>
                  <span>{loadedFilePath || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <span>{status}</span>
                </div>
              </>
            ) : dataType === "orthophoto" ? (
              <>
                <div>
                  <span className="text-muted-foreground">Raster: </span>
                  <span>{rasterName || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <span>{isOrthophotoBusy ? "Processing..." : orthophotoStatus}</span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-muted-foreground">Mean NDVI: </span>
                  <span>0.68</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Std Dev: </span>
                  <span>0.12</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Data Type Switcher - Bottom Center */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40">
          <div className="flex bg-card/95 backdrop-blur border border-border rounded-lg p-1 shadow-lg">
            <button
              onClick={() => setDataType("3d")}
              className={`px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all ${
                dataType === "3d"
                  ? "bg-primary text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Cuboid className="w-5 h-5" />
              <span className="text-sm font-medium">3D Model</span>
            </button>
            <button
              onClick={() => setDataType("orthophoto")}
              className={`px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all ${
                dataType === "orthophoto"
                  ? "bg-primary text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Map className="w-5 h-5" />
              <span className="text-sm font-medium">Orthophoto</span>
            </button>
            <button
              onClick={() => setDataType("ndvi")}
              className={`px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all ${
                dataType === "ndvi"
                  ? "bg-primary text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <TreePine className="w-5 h-5" />
              <span className="text-sm font-medium">NDVI</span>
            </button>
          </div>
        </div>

        {/* Canvas layers - keep 3D mounted so view state is preserved across data type switches */}
        <div
          ref={threeContainerRef}
          className={`absolute inset-0 z-0 ${
            dataType === "3d" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        />
        <div
          ref={orthophotoMapNodeRef}
          className={`absolute inset-0 z-0 transition-opacity duration-150 ${
            dataType === "orthophoto" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        />
        <canvas
          ref={canvasRef}
          className={`w-full h-full absolute inset-0 z-0 ${dataType === "ndvi" ? "block" : "hidden"}`}
          style={{ display: dataType === "ndvi" ? "block" : "none" }}
        />

        {dataType === "3d" && (
          <canvas
            ref={measurementCanvasRef}
            className="absolute inset-0 z-20 pointer-events-none"
          />
        )}

        {((dataType !== "orthophoto" && (isLoadingPly || plyError)) ||
          (dataType === "orthophoto" && (isOrthophotoBusy || orthophotoStatus.startsWith("Error:")))) && (
          <div className="absolute bottom-4 left-4 z-40 bg-card/95 backdrop-blur border border-border rounded-lg px-3 py-2 text-xs">
            {dataType === "orthophoto" ? (
              isOrthophotoBusy ? (
                "Importing orthophoto package..."
              ) : (
                <span className="text-red-400">{orthophotoStatus}</span>
              )
            ) : isLoadingPly ? (
              "Importing file..."
            ) : (
              <span className="text-red-400">{plyError}</span>
            )}
          </div>
        )}

        {isDragActive && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 border-2 border-dashed border-primary pointer-events-none">
            <div className="px-5 py-3 rounded-lg bg-card/95 border border-border text-center">
              <p className="text-sm font-medium">
                {dataType === "3d"
                  ? "Drop a 3D file (.ply, .obj, .glb, .gltf)"
                  : dataType === "orthophoto"
                    ? "Drop raster package files (.tif/.tiff/.tfw/.prj/.dxf)"
                    : "Drop a raster/image file"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Scrollable Controls Only */}
      {!isViewerFullscreen && (
        <div className="w-80 bg-card border-l border-border flex flex-col">
        {/* Fixed Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base">Viewer Controls</h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="space-y-2">
              {/* Model Info */}
              <details className="border border-border rounded-lg overflow-hidden">
                <summary className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors cursor-pointer">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    Model Information
                  </span>
                  <span className="text-muted-foreground">Γû╝</span>
                </summary>
                <div className="px-4 pb-4 space-y-2 text-xs border-t border-border">
                  <PropertyRow label="File" value={dataType === "3d" ? plyName : "scene_preview"} />
                  {dataType !== "3d" && <PropertyRow label="Raster" value={rasterName} />}
                  <PropertyRow label="Size" value="342 MB" />
                  <PropertyRow label="Vertices" value="1,245,832" />
                  <PropertyRow label="Faces" value="2,491,664" />
                  <PropertyRow label="Texture" value="4096x4096 px" />
                  <PropertyRow label="Format" value="Wavefront OBJ" />
                  <PropertyRow label="Created" value="Feb 25, 2026" />
                </div>
              </details>

              {/* Camera Settings */}
              {dataType === "3d" && (
                <details className="border border-border rounded-lg overflow-hidden">
                  <summary className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors cursor-pointer">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Camera Settings
                    </span>
                    <span className="text-muted-foreground">Γû╝</span>
                  </summary>
                  <div className="px-4 pb-4 space-y-4 border-t border-border">
                    <div>
                      <label className="text-sm mb-2 block">Field of View</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="30"
                          max="120"
                          step="5"
                          value={fieldOfView}
                          onChange={(event) => setFieldOfView(parseInt(event.target.value, 10))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground w-10">{fieldOfView}┬░</span>
                      </div>
                    </div>
                  </div>
                </details>
              )}

              {/* Rendering Options */}
              {dataType === "3d" && (
                <details className="border border-border rounded-lg overflow-hidden" open>
                  <summary className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors cursor-pointer">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      Rendering Options
                    </span>
                    <span className="text-muted-foreground">Γû╝</span>
                  </summary>
                  <div className="px-4 pb-4 space-y-3 border-t border-border">
                    <ToggleRow label="Show Grid" checked={showGrid} onChange={setShowGrid} />
                    <ToggleRow label="Wireframe" checked={wireframe} onChange={setWireframe} />
                    <ToggleRow label="Lighting" checked={lighting} onChange={setLighting} />
                    <ToggleRow label="Show Axes" checked={showAxes} onChange={setShowAxes} />
                    <ToggleRow label="Shadows" checked={showShadows} onChange={setShowShadows} />
                    <ToggleRow label="Ambient Occlusion" checked={ambientOcclusion} onChange={setAmbientOcclusion} />

                    <div className="pt-2">
                      <label className="text-sm mb-2 block">Render Quality</label>
                      <select
                        value={renderQuality}
                        onChange={(event) =>
                          setRenderQuality(event.target.value as "low" | "medium" | "high" | "ultra")
                        }
                        className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm"
                      >
                        <option value="low">Low (Fastest)</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="ultra">Ultra (Best Quality)</option>
                      </select>
                    </div>
                    
                    <div className="pt-2">
                      <label className="text-sm mb-2 block">Point Cloud Opacity</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={meshOpacity}
                          onChange={(e) => setMeshOpacity(parseInt(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground w-8">{meshOpacity}%</span>
                      </div>
                    </div>
                  </div>
                </details>
              )}

              {/* Point Cloud Settings */}
              {dataType === "3d" && effective3DViewMode === "pointcloud" && (
                <details className="border border-border rounded-lg overflow-hidden">
                  <summary className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors cursor-pointer">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Navigation className="w-4 h-4" />
                      Point Cloud Settings
                    </span>
                    <span className="text-muted-foreground">Γû╝</span>
                  </summary>
                  <div className="px-4 pb-4 space-y-4 border-t border-border">
                    <div>
                      <label className="text-sm mb-2 block">Point Size</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0.001"
                          max="0.2"
                          step="0.001"
                          value={pointSize}
                          onChange={(e) => setPointSize(parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground w-12">{pointSize.toFixed(3)}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm mb-2 block">Color Mode</label>
                      <select
                        value={colorMode}
                        onChange={(event) => setColorMode(event.target.value as PointCloudColorMode)}
                        className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm"
                      >
                        <option value="rgb">RGB</option>
                        <option value="elevation">Elevation</option>
                        <option value="intensity">Intensity</option>
                        <option value="classification">Classification</option>
                      </select>
                    </div>
                  </div>
                </details>
              )}

              {dataType === "orthophoto" && (
                <details className="border border-border rounded-lg overflow-hidden" open>
                  <summary className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors cursor-pointer">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Map className="w-4 h-4" />
                      Orthophoto Geospatial Tools
                    </span>
                    <span className="text-muted-foreground">Γû╝</span>
                  </summary>
                  <div className="px-4 pb-4 space-y-3 border-t border-border">
                    <div>
                      <label className="text-sm mb-2 block">Basemap</label>
                      <select
                        value={orthophotoBasemapId}
                        onChange={(event) =>
                          setOrthophotoBasemapId(event.target.value as keyof typeof ORTHOPHOTO_BASEMAPS)
                        }
                        disabled={isOrthophotoBusy}
                        className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm"
                      >
                        {Object.entries(ORTHOPHOTO_BASEMAPS)
                          .filter(([, config]) => ENABLE_GOOGLE_BASEMAP || config.kind !== "google")
                          .map(([id, config]) => (
                          <option key={id} value={id}>
                            {config.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showOrthophotoHillshade}
                        onChange={(event) => setShowOrthophotoHillshade(event.target.checked)}
                        disabled={isOrthophotoBusy}
                      />
                      Terrain hillshade overlay
                    </label>

                    <div className="text-xs rounded border border-border bg-input/20 px-3 py-2">
                      {isOrthophotoBusy ? "Processing..." : orthophotoStatus}
                    </div>

                    <div className="rounded border border-border p-3 space-y-3 bg-input/10">
                      <div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={orthophotoLayerControls.raster.visible}
                            onChange={(event) =>
                              setOrthophotoLayerControls((previous) => ({
                                ...previous,
                                raster: { ...previous.raster, visible: event.target.checked },
                              }))
                            }
                            disabled={isOrthophotoBusy}
                          />
                          Raster layer
                        </label>
                        <label className="text-xs text-muted-foreground block mt-1">
                          Opacity: {Math.round(orthophotoLayerControls.raster.opacity * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round(orthophotoLayerControls.raster.opacity * 100)}
                          onChange={(event) => {
                            const value = Number.parseInt(event.target.value, 10) / 100;
                            setOrthophotoLayerControls((previous) => ({
                              ...previous,
                              raster: { ...previous.raster, opacity: value },
                            }));
                          }}
                          disabled={isOrthophotoBusy}
                          className="w-full"
                        />
                      </div>

                      {orthophotoLayerControls.dxf.map((dxfControl, index) => (
                        <div key={dxfControl.name} className="border-t border-border pt-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={dxfControl.visible}
                              onChange={(event) =>
                                setOrthophotoLayerControls((previous) => ({
                                  ...previous,
                                  dxf: previous.dxf.map((entry, itemIndex) =>
                                    itemIndex === index ? { ...entry, visible: event.target.checked } : entry
                                  ),
                                }))
                              }
                              disabled={isOrthophotoBusy}
                            />
                            DXF: {dxfControl.name}
                          </label>
                          <label className="text-xs text-muted-foreground block mt-1">
                            Opacity: {Math.round(dxfControl.opacity * 100)}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(dxfControl.opacity * 100)}
                            onChange={(event) => {
                              const value = Number.parseInt(event.target.value, 10) / 100;
                              setOrthophotoLayerControls((previous) => ({
                                ...previous,
                                dxf: previous.dxf.map((entry, itemIndex) =>
                                  itemIndex === index ? { ...entry, opacity: value } : entry
                                ),
                              }));
                            }}
                            disabled={isOrthophotoBusy}
                            className="w-full"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              )}

              {/* Measurements & Annotations */}
              <details className="border border-border rounded-lg overflow-hidden">
                <summary className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors cursor-pointer">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Ruler className="w-4 h-4" />
                    Measurements & Tools
                  </span>
                  <span className="text-muted-foreground">Γû╝</span>
                </summary>
                <div className="px-4 pb-4 space-y-3 border-t border-border">
                  <ToggleRow label="Show Measurements" checked={showMeasurements} onChange={handleShowMeasurementsChange} />
                  
                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={() => selectMeasurementTool("distance")}
                      className={`w-full px-3 py-2 border rounded text-sm flex items-center gap-2 transition-colors ${
                        measurementTool === "distance"
                          ? "bg-primary text-white border-primary"
                          : "bg-secondary hover:bg-accent border-border"
                      }`}
                    >
                      <Ruler className="w-4 h-4" />
                      Distance Tool
                    </button>
                    <button
                      type="button"
                      onClick={() => selectMeasurementTool("area")}
                      className={`w-full px-3 py-2 border rounded text-sm flex items-center gap-2 transition-colors ${
                        measurementTool === "area"
                          ? "bg-primary text-white border-primary"
                          : "bg-secondary hover:bg-accent border-border"
                      }`}
                    >
                      <Box className="w-4 h-4" />
                      Area Tool
                    </button>
                  </div>
                </div>
              </details>

            </div>

            {/* Action Buttons */}
            <div className="space-y-2 mt-6">
              <button
                onClick={() => void captureAndSaveScreenshot()}
                className="w-full px-4 py-2.5 bg-secondary hover:bg-accent border border-border rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <FileImage className="w-4 h-4" />
                Take Screenshot
              </button>
              <button
                type="button"
                onClick={() => setIsViewerFullscreen(true)}
                className="w-full px-4 py-2.5 bg-secondary hover:bg-accent border border-border rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Maximize2 className="w-4 h-4" />
                Fullscreen
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

function ViewCube({ onSelectView }: { onSelectView: (view: "top" | "front" | "right") => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 p-2">
      <ViewCubeButton label="Top" onClick={() => onSelectView("top")} />
      <ViewCubeButton label="Front" onClick={() => onSelectView("front")} />
      <ViewCubeButton label="Right" onClick={() => onSelectView("right")} />
    </div>
  );
}

function ViewCubeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-12 h-12 bg-secondary hover:bg-accent border border-border rounded text-xs transition-colors"
    >
      {label}
    </button>
  );
}

function IconButton({
  icon: Icon,
  active,
  onClick,
  tooltip,
}: {
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  tooltip?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`
        w-9 h-9 rounded flex items-center justify-center transition-colors
        ${active ? "bg-primary text-white" : "hover:bg-accent"}
      `}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="w-11 h-6 bg-secondary border border-border rounded-full relative data-[state=checked]:bg-primary transition-colors outline-none"
      >
        <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-5.5" />
      </Switch.Root>
    </div>
  );
}

