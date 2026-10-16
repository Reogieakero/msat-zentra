import multer from "multer";

const ALLOWED = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export const MAX_SF10_BYTES = 5 * 1024 * 1024;

export const sf10Upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SF10_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop()?.toLowerCase();
    const isXlsx = ext === "xlsx" || file.mimetype === ALLOWED[3];
    if ((ALLOWED as readonly string[]).includes(file.mimetype) || isXlsx) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, PNG, or XLSX files are allowed for SF10 uploads."));
    }
  },
});
