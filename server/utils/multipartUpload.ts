import multer from "multer";

// Multer 2.3 adds this protection as an opt-in. A single multipart text field
// must not allocate an enormous sparse array when application code reads it.
export const MAX_MULTIPART_ARRAY_INDEX = 1000;

function createMultipartUpload(options: multer.Options = {}) {
  const limits = {
    ...options.limits,
    fieldArrayIndexLimit: MAX_MULTIPART_ARRAY_INDEX,
  };
  return multer({ ...options, limits });
}

// Preserve the existing storage factories, field/file filters and limits.
// Route owners retain their authentication and response handling.
export default Object.assign(createMultipartUpload, {
  memoryStorage: multer.memoryStorage,
  diskStorage: multer.diskStorage,
  MulterError: multer.MulterError,
});
