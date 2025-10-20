export const ENV = {
  appId: process.env.VITE_APP_ID ?? "post-sniper",
  cookieSecret: process.env.JWT_SECRET ?? "default-secret-change-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "http://localhost:3000", // Not used in Railway
  ownerId: process.env.OWNER_OPEN_ID ?? "public",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
