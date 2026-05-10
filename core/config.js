import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT) || 3000,
  provider: process.env.PROVIDER || "toonstream",
};

export default config;
