// const app = express();
// const PORT = 3000;
// const client = new OpenAI({ apiKey: process.env.OpenAI_API_KEY });

// app.post("/upload", async (req, res) => {
//   try {
//     const { document } = req.body;
//     if (!text) {
//       return res.status(400).json({ error: "Text is required" });
//     }
//     const system = "You are a text summarization assistant.";
//     const user = `Summarize the following text:\n\n${text}`;
//     const completion = await client.chat.completion.create({
//       model: "gpt-4o-mini",
//       messages: [
//         { role: "system", content: system },
//         { role: "user", content: user },
//       ],
//     });
//     const summarizer = completion.choices[0].message.content;
//     res.json({ summarizer });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ error: "Failed to summarize" });
//   }
// });

// app.listen(PORT, () =>
//   console.log(`Server running on http://localhost:${PORT}`)
// );

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import pdf from "pdf-parse";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument } from "pdf-lib";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(cors());
const upload = multer({ dest: "uploads/" });
const client = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY });

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    let extractedText = "";
    let fileType = req.file.mimetype;

    // Extract PDF text
    if (fileType === "application/pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      extractedText = pdfData.text;
    }
    // Extract Word text
    else if (
      fileType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const { default: mammoth } = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value;
    }
    // Extract TXT
    else if (fileType === "text/plain") {
      extractedText = fs.readFileSync(filePath, "utf-8");
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    // Ask LLM to summarize while preserving structure
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a summarizer. Summarize the text while keeping the original structure (headings, bullet points, numbered lists, etc.).",
        },
        { role: "user", content: extractedText },
      ],
    });

    const summaryText = completion.choices[0].message.content;

    let outputBuffer;

    // Rebuild in same format
    if (fileType === "application/pdf") {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 800]);
      page.drawText(summaryText, { x: 50, y: 750, size: 12 });
      outputBuffer = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.send(Buffer.from(outputBuffer));
    } else if (
      fileType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: summaryText.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [new TextRun(line)],
                })
            ),
          },
        ],
      });
      outputBuffer = await Packer.toBuffer(doc);
      res.setHeader("Content-Type", fileType);
      res.send(outputBuffer);
    } else {
      res.setHeader("Content-Type", "text/plain");
      res.send(summaryText);
    }

    fs.unlinkSync(filePath); // cleanup
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Summarization failed" });
  }
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));
