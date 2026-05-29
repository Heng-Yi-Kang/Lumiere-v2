# TODO

## Next steps

- Add inline client-side validation before upload for:
  - unsupported extensions
  - files larger than `100 MB`
  - empty files
- Add clearer upload progress and error states in the notebook modal and dashboard.
- Add download and "open in new tab" actions for uploaded materials.
- Add confirmation UI before destructive file deletion.
- Add server-side cleanup tests for hard delete to ensure DB rows and filesystem artifacts stay in sync.
- Add integration tests for:
  - upload success
  - preview fetch
  - invalid file type rejection
  - oversize rejection
  - delete success
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
