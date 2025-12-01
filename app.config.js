// app.config.js
import 'dotenv/config';

export default {
  name: "EarningsEdge",
  slug: "earningsedge",
  version: "1.0.1",
  orientation: "portrait",
  // Just add these two lines anywhere in your config
jsEngine: "hermes",
updates: { enabled: false },
icon: "./icon.png",                   // ← you already have this
  splash: {
    image: "./splash-icon.png",              // ← add this
    backgroundColor: "#0F172A",         // ← dark slate (or any color that matches your splash PNG)
    resizeMode: "contain",              // or "cover" — "contain" is safest
  },  ios: {
    bundleIdentifier: "com.xaviernavarro.earningsedge2",
    usesSceneDelegate: true
  },
  android: {
    package: "com.xaviernavarro.earningsedge2"
  },
  extra: {
    finnhubApiKey: process.env.FINNHUB_API_KEY || 'dummy-finnhub',
    alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || 'dummy-alpha', // ← just add this line
    eas: {
      projectId: "8c23cb27-e0f4-4e85-af61-7a6a3f9a56e9"
    }
  
  },
};