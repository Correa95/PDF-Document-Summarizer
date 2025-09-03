import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import pdf from "pdf-parse";
// import { Document, Packer, Paragraph, TextRun } from "docx";
// import { PDFDocument } from "pdf-lib";
import OpenAI from "openai";

dotenv.config();
const app = express();
const PORT = 3000;
app.use(cors());
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

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    let extractedText = "";

    // Handle only PDF for brevity here
    if (req.file.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      extractedText = pdfData.text;
    } else if (req.file.mimetype === "text/plain") {
      extractedText = fs.readFileSync(filePath, "utf-8");
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    // Split into chunks
    const chunks = chunkText(extractedText, 2000);
    const chunkSummaries = [];

    // Summarize each chunk
    for (let i = 0; i < chunks.length; i++) {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful summarizer." },
          { role: "user", content: `Summarize this section:\n\n${chunks[i]}` },
        ],
      });
      chunkSummaries.push(completion.choices[0].message.content);
    }

    // Combine summaries into one final summary
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

    fs.unlinkSync(filePath); // cleanup temp file

    res.json({ summary: finalSummary, sections: chunkSummaries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Summarization failed" });
  }
});
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
