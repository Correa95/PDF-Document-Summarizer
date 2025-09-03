const app = express();
const PORT = 3000;
const client = new OpenAI({ apiKey: process.env.OpenAI_API_KEY });

app.post("/upload", async (req, res) => {
  try {
    const { document } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }
    const system = "You are a text summarization assistant.";
    const user = `Summarize the following text:\n\n${text}`;
    const completion = await client.chat.completion.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const summarizer = completion.choices[0].message.content;
    res.json({ summarizer });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to summarize" });
  }
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
