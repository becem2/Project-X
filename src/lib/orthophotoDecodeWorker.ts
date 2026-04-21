import { fromArrayBuffer } from "geotiff";

type WorkerLikeScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

const workerScope = self as unknown as WorkerLikeScope;

type GeoPoint = {
  x: number;
  y: number;
};

type WorkerRequest = {
  buffer: ArrayBuffer;
  maxDecodePixels: number;
};

type WorkerResponse =
  | {
      ok: true;
      sourceWidth: number;
      sourceHeight: number;
      decodeWidth: number;
      decodeHeight: number;
      decodeScale: number;
      sampleCount: number;
      rgba: Uint8ClampedArray;
      georef: { sourceCrs: string | null; rawCorners: GeoPoint[] } | null;
    }
  | {
      ok: false;
      error: string;
    };

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

const getDecodeDimensions = (sourceWidth: number, sourceHeight: number, maxDecodePixels: number) => {
  const sourcePixels = sourceWidth * sourceHeight;
  if (sourcePixels <= maxDecodePixels) {
    return {
      decodeWidth: sourceWidth,
      decodeHeight: sourceHeight,
      decodeScale: 1,
    };
  }

  const scale = Math.sqrt(maxDecodePixels / sourcePixels);
  const decodeWidth = Math.max(1, Math.floor(sourceWidth * scale));
  const decodeHeight = Math.max(1, Math.floor(sourceHeight * scale));

  return {
    decodeWidth,
    decodeHeight,
    decodeScale: decodeWidth / sourceWidth,
  };
};

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  try {
    const { buffer, maxDecodePixels } = event.data;
    const tiff = await fromArrayBuffer(buffer);
    const image = await tiff.getImage();

    const sourceWidth = image.getWidth();
    const sourceHeight = image.getHeight();
    const { decodeWidth, decodeHeight, decodeScale } = getDecodeDimensions(
      sourceWidth,
      sourceHeight,
      maxDecodePixels
    );

    const rasters = await image.readRasters({
      interleave: false,
      width: decodeWidth,
      height: decodeHeight,
      resampleMethod: "bilinear",
    });

    const sampleCount = rasters.length;
    const pixelCount = decodeWidth * decodeHeight;
    const rgba = new Uint8ClampedArray(pixelCount * 4);

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
        rgba[offset] = stretchToByte(red[index]!, redMinMax.min, redMinMax.max);
        rgba[offset + 1] = stretchToByte(green[index]!, greenMinMax.min, greenMinMax.max);
        rgba[offset + 2] = stretchToByte(blue[index]!, blueMinMax.min, blueMinMax.max);
        rgba[offset + 3] = alpha
          ? stretchToByte(alpha[index]!, alphaMinMax!.min, alphaMinMax!.max)
          : 255;
      }
    } else {
      const gray = rasters[0]!;
      const grayMinMax = getMinMax(gray);

      for (let index = 0; index < pixelCount; index += 1) {
        const offset = index * 4;
        const grayValue = stretchToByte(gray[index]!, grayMinMax.min, grayMinMax.max);
        rgba[offset] = grayValue;
        rgba[offset + 1] = grayValue;
        rgba[offset + 2] = grayValue;
        rgba[offset + 3] = 255;
      }
    }

    let georef: { sourceCrs: string | null; rawCorners: GeoPoint[] } | null = null;
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

    const response: WorkerResponse = {
      ok: true,
      sourceWidth,
      sourceHeight,
      decodeWidth,
      decodeHeight,
      decodeScale,
      sampleCount,
      rgba,
      georef,
    };

    workerScope.postMessage(response, [rgba.buffer]);
  } catch (error) {
    const response: WorkerResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "TIFF decoding failed in worker.",
    };
    workerScope.postMessage(response);
  }
};
