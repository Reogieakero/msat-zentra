import multer from "multer";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png"] as const;
export const MAX_SF10_BYTES = 5 * 1024 * 1024; // 5 MB

export const sf10Upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SF10_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, or PNG files are allowed for SF10 uploads."));
    }
  },
});
