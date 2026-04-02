declare module "js-aruco" {
  export const AR: {
    Detector: new () => {
      detect: (
        imageData: ImageData
      ) => Array<{ id: number; corners: Array<{ x: number; y: number }> }>;
    };
  };
}

