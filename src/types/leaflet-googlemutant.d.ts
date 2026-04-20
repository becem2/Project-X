import "leaflet";

declare module "leaflet" {
  interface GridLayer {
    googleMutant(options: {
      type?: "roadmap" | "satellite" | "terrain" | "hybrid";
      styles?: unknown[];
      maxZoom?: number;
      minZoom?: number;
      opacity?: number;
      noWrap?: boolean;
      [key: string]: unknown;
    }): GridLayer;
  }

  namespace gridLayer {
    function googleMutant(options: {
      type?: "roadmap" | "satellite" | "terrain" | "hybrid";
      styles?: unknown[];
      maxZoom?: number;
      minZoom?: number;
      opacity?: number;
      noWrap?: boolean;
      [key: string]: unknown;
    }): GridLayer;
  }
}
