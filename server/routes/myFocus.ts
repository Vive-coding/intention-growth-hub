import { Router } from "express";
import { MyFocusService } from "../services/myFocusService";

const router = Router();

// Get My Focus data
router.get("/", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const myFocus = await MyFocusService.getMyFocus(userId);
    const needsSetup = await MyFocusService.needsInitialSetup(userId);

    res.json({
      ...myFocus,
      needsSetup,
    });
  } catch (e) {
    console.error("[my-focus] failed", e);
    res.status(500).json({ message: "Failed to get My Focus data" });
  }
});

// Check if user needs initial setup
router.get("/needs-setup", async (req: any, res) => {
  try {
    const userId = req.user?.id || req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const needsSetup = await MyFocusService.needsInitialSetup(userId);
    res.json({ needsSetup });
  } catch (e) {
    console.error("[my-focus] needs-setup failed", e);
    res.status(500).json({ message: "Failed to check setup status" });
  }
});

export default router;
