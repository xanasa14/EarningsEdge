// app.config.js
import 'dotenv/config';

export default {
  name: "EarningsEdge",
  slug: "earningsedge",
  version: "1.0.0",
  orientation: "portrait",
  ios: {
    bundleIdentifier: "com.xaviernavarro.earningsedge"
  },
  android: {
    package: "com.xaviernavarro.earningsedge"
  },
  extra: {
    finnhubApiKey: process.env.FINNHUB_API_KEY || 'dummy-finnhub',
    alphaVantageApiKey: process.env.ALPHA_VANTAGE_API_KEY || 'dummy-alpha', // ← just add this line
  },
};