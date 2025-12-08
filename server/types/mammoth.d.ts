declare module "mammoth" {
  interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface ExtractOptions {
    path: string;
  }

  const mammoth: {
    extractRawText(options: ExtractOptions): Promise<MammothResult>;
  };

  export = mammoth;
}
