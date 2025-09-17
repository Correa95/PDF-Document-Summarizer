import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import pdf from "pdf-extraction";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// OpenAI client
if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "⚠️ OPENAI_API_KEY is missing! Set it in .env (local) or Render Environment Variables (production)."
  );
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Utility to chunk text into pieces for summarization
function chunkText(text, chunkSize = 2000) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

// Extract text from PDF
async function extractPdfText(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const result = await pdf(dataBuffer);
  return result.text;
}

// Upload endpoint
app.post("/api/v1/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Received file:", req.file.originalname);
    console.log("OPENAI_API_KEY present?", !!process.env.OPENAI_API_KEY);

    const filePath = req.file.path;
    let extractedText = "";

    // Handle PDF and TXT files
    if (req.file.mimetype === "application/pdf") {
      extractedText = await extractPdfText(filePath);
    } else if (req.file.mimetype === "text/plain") {
      extractedText = fs.readFileSync(filePath, "utf-8");
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const chunks = chunkText(extractedText, 2000);
    const chunkSummaries = [];

    // Summarize each chunk
    for (let chunk of chunks) {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful summarizer." },
          { role: "user", content: `Summarize this section:\n\n${chunk}` },
        ],
      });
      chunkSummaries.push(completion.choices[0].message.content);
    }

    // Combine chunk summaries into a final summary
    const finalCompletion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful summarizer. Combine these section summaries into a concise document summary, preserving structure.",
        },
        { role: "user", content: chunkSummaries.join("\n\n") },
      ],
    });

    const finalSummary = finalCompletion.choices[0].message.content;

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ summary: finalSummary, sections: chunkSummaries });
  } catch (err) {
    console.error("Summarization error:", err);
    res
      .status(500)
      .json({ error: "Summarization failed", detail: err.message || err });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
