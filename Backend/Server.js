import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";
import pdf from "pdf-extraction";

dotenv.config();
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });
const client = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY });

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
  try {
    const filePath = req.file.path;
    let extractedText = "";

    if (req.file.mimetype === "application/pdf") {
      extractedText = await extractPdfText(filePath);
    } else if (req.file.mimetype === "text/plain") {
      extractedText = fs.readFileSync(filePath, "utf-8");
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const chunks = chunkText(extractedText, 2000);
    const chunkSummaries = [];

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

    const finalCompletion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful summarizer. Combine these section summaries into a concise document summary, preserving the original structure (headings, bullet points, sections).",
        },
        { role: "user", content: chunkSummaries.join("\n\n") },
      ],
    });

    const finalSummary = finalCompletion.choices[0].message.content;
    fs.unlinkSync(filePath);

    res.json({ summary: finalSummary, sections: chunkSummaries });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Summarization failed", detail: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`)
);
