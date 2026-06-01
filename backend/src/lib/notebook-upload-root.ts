export function getNotebookUploadRoot() {
  return process.env.NOTEBOOK_UPLOAD_ROOT || `${process.cwd()}/public/uploads/notebooks`;
}
