// app.config.js
import 'dotenv/config'; // ← This single line loads your .env file

export default {
  name: "YourAppName",
  slug: "your-app-slug",
  version: "1.0.0",
  // ... keep any other fields you already have (orientation, icon, etc.)

  extra: {
    // This will use your real key from .env when developing
    // Falls back to a dummy if .env is missing (safe for GitHub)
    finnhubApiKey: process.env.FINNHUB_API_KEY || 'dummy-key-for-github',
  },
};