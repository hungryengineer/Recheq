// Type declarations for the pdf-parse library's direct lib entrypoint.
// The package ships @types/pdf-parse for its main entry only; importing
// 'pdf-parse/lib/pdf-parse.js' (to avoid the debug-mode side effect in
// index.js) needs an explicit ambient declaration.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    text: string;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;

  export = pdfParse;
}
