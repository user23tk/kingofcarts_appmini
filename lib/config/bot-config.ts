export function getBotConfig() {
  return {
    username: process.env.BOT_USERNAME || "kingofcarts_betabot",
    displayName: process.env.BOT_DISPLAY_NAME || "King of Carts",
  }
}
