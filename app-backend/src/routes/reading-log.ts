import { Router, Request, Response } from "express";
import { requireAuth, getAuth } from "@clerk/express";

const router = Router();

// Stub: parse freeform reading log text into structured book data
// Real LLM integration deferred to Task 6
router.post("/api/reading-log/parse", requireAuth(), async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { text } = req.body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "text field is required" });
    return;
  }

  // Mock parsed results - returns plausible structure
  // Each entry: { title, author, inferred_status, inferred_reactions }
  const mockParsed = [
    {
      title: "Sample Book From Input",
      author: null,
      inferred_status: "finished",
      inferred_reactions: ["👍"],
    },
  ];

  res.json({ parsed: mockParsed, raw_input: text.trim() });
});

export default router;
