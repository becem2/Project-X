declare module "leaflet.gridlayer.googlemutant/src/Leaflet.GoogleMutant.mjs" {
  import { GridLayer, GridLayerOptions } from "leaflet";

  type GoogleMutantOptions = GridLayerOptions & {
    type?: "roadmap" | "satellite" | "terrain" | "hybrid";
    styles?: unknown[];
  };

  export default class GoogleMutant extends GridLayer {
    constructor(options?: GoogleMutantOptions);
  }
}
