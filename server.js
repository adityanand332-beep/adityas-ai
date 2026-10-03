import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "missing-groq-api-key",
  baseURL: "https://api.groq.com/openai/v1"
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (!messages.length) {
      return res.status(400).json({ error: "No messages provided." });
    }

    const cleanMessages = messages
      .slice(-20)
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));

    if (!cleanMessages.length) {
      return res.status(400).json({ error: "No valid chat messages provided." });
    }

    if (!process.env.GROQ_API_KEY?.trim()) {
      return res.status(503).json({
        error: "Groq API key is missing. Add GROQ_API_KEY to your .env file and restart the server."
      });
    }

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are ADITYA'S AI, a helpful general-purpose assistant. Answer accurately and clearly. " +
            "If you are uncertain, say so rather than inventing facts. Match the user's language when practical. " +
            "Use concise formatting and code blocks when useful."
        },
        ...cleanMessages
      ]
    });

    const reply = response.choices[0]?.message?.content;
    if (!reply) {
      return res.status(502).json({ error: "Groq returned an empty response. Please try again." });
    }

    res.json({ reply });
  } catch (error) {
    const status = error?.status || 500;
    console.error("Groq request failed:", error?.message || error);
    const clientStatus = status >= 400 && status < 500 ? status : 502;
    const errorMessage = status === 401 || status === 403
      ? "Groq rejected the API key. Check GROQ_API_KEY in your .env file."
      : status === 429
        ? "Groq rate limit or quota reached. Check your Groq account and try again later."
        : "The Groq AI request failed. Check the server terminal for details.";

    res.status(clientStatus).json({ error: errorMessage });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`ADITYA'S AI running at http://localhost:${port}`);
});
