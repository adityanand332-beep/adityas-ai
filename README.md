# ADITYA'S AI

A shareable AI chat app powered by Groq and a Node.js/Express backend.

The assistant can answer general questions and questions about Aditya using the confirmed public profile built into the server prompt.

## Run locally

Requirements: Node.js 18+ and a Groq API key.

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and set `GROQ_API_KEY` to your Groq API key.
3. Start the server:

   ```bash
   npm start
   ```

4. Open http://localhost:3000.

Keep `.env` private. Never put the API key in browser-side files or commit it to Git.

## Publish on Render

1. Put this project in its own GitHub repository. Do not upload `.env` or `node_modules`.
2. In Render, choose **New + → Blueprint** and connect that repository.
3. Render reads `render.yaml`. When prompted, enter `GROQ_API_KEY` as a secret environment variable; do not put the key in the YAML file.
4. Deploy the service. Once deployment succeeds, Render provides a public `https://...onrender.com` URL that can be shared.

The free Render service may sleep when idle, so the first request after a quiet period can take longer. Anyone with the public link can use the chatbot, subject to Groq account limits and availability.
