declare module 'sanitize-html' {
  type SanitizerOptions = {
    allowedAttributes?: Record<string, string[]>;
    allowedSchemes?: string[];
    allowedTags?: string[];
  };

  interface SanitizeHtml {
    (dirty: string, options?: SanitizerOptions): string;
    defaults: {
      allowedTags: string[];
    };
  }

  const sanitizeHtml: SanitizeHtml;
  export default sanitizeHtml;
}
