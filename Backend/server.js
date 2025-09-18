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

const upload = multer({ dest: "uploads/" });

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OpenAI API key. Set it in your .env file.");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function chunkText(text, chunkSize = 2000) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

async function extractPdfText(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const result = await pdf(dataBuffer);
  return result.text;
}

app.post("/api/v1/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = req.file.path;
  const mimeType = req.file.mimetype;

  try {
    let extractedText = "";

    if (mimeType === "application/pdf") {
      extractedText = await extractPdfText(filePath);
    } else if (mimeType === "text/plain") {
      extractedText = fs.readFileSync(filePath, "utf-8");
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const chunks = chunkText(extractedText, 2000);
    const chunkSummaries = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const completion = await client.chat.completions.create({
          model: "gpt-4",
          messages: [
            { role: "system", content: "You are a helpful summarizer." },
            {
              role: "user",
              content: `Summarize this section:\n\n${chunks[i]}`,
            },
          ],
        });
        chunkSummaries.push(completion.choices[0].message.content);
      } catch (err) {
        console.error(`Chunk ${i} failed:`, err.message);
        chunkSummaries.push("[ERROR: Could not summarize this section]");
      }
    }

    const finalCompletion = await client.chat.completions.create({
      model: "gpt-4",
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
    fs.unlinkSync(filePath);

    res.json({ summary: finalSummary, sections: chunkSummaries });
  } catch (err) {
    console.error("Summarization error:", {
      message: err.message,
      stack: err.stack,
      response: err.response?.data || null,
    });
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
    res
      .status(500)
      .json({ error: "Summarization failed", detail: err.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
