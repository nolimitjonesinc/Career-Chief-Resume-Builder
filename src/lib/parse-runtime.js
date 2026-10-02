// Browser-side halves of the parser check: how to turn the Word document into
// bytes and how to read text back out of them. Kept apart from parsecheck.js so
// that module stays testable in Node with its own pair.
export const browserRuntime = {
  toBytes: async (document) => {
    const { Packer } = await import("docx");
    return new Uint8Array(await (await Packer.toBlob(document)).arrayBuffer());
  },
  extractText: async (bytes) => {
    const mammoth = await import("mammoth/mammoth.browser");
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return (await mammoth.extractRawText({ arrayBuffer: buffer })).value;
  },
};
