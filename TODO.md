# TODO

## Next steps

- Measure upload-time extraction latency on large `docx` and `pptx` files.
- Move preview extraction to a background job if synchronous upload processing becomes too slow.
- Improve `pptx` preview formatting if current HTML extraction is not readable enough for real slide decks.
- Improve `docx` preview formatting for complex tables, images, and nested formatting.
- Decide whether notebooks should support file replacement/versioning instead of append-only uploads.
- Decide whether soft delete or audit history is needed later.
- Revisit notebook file metadata model if summaries should become AI-generated instead of extracted-text snippets.
- Add support later for skipped sources:
  - YouTube links
  - website/article links
