import { Router } from "express";
import multer from "multer";
import { requireAdmin } from "../../auth";
import { storeMediaForJob } from "../../services/projectService";

const upload = multer({ dest: "uploads/" }); // Adjust storage as needed
const router = Router();

// POST /admin/job-media-upload
router.post(
  "/job-media-upload",
  requireAdmin,
  upload.single("media"),
  async (req, res) => {
    try {
      const { jobId, mediaType } = req.body;
      const userId = String((req.user as any)?.id || "").trim();
      if (!req.file || !jobId) {
        return res.status(400).json({ error: "Missing file or jobId" });
      }
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      // Store file and link to job
      const mediaRecord = await storeMediaForJob({
        jobId,
        filePath: req.file.path,
        originalName: req.file.originalname,
        mediaType: mediaType || req.file.mimetype,
        uploadedBy: userId,
      });
      res.json({ success: true, media: mediaRecord });
    } catch (err) {
      res.status(500).json({ error: "Upload failed", details: String(err) });
    }
  }
);

export default router;
