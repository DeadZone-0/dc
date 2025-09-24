/**
 * Global configuration settings for the AI Discord bot
 */
module.exports = {
  // AI Provider Settings
  PRIMARY_AI: "gemini", // "gemini", "chutes", "gemini", or "colab"
  FALLBACK_ENABLED: true, // Whether to try fallback AI when primary fails
  FALLBACK_ORDER: ["openrouter", "chutes", "gemini"], // Order to try fallback providers
  
  // OpenRouter Settings
  OPENROUTER_API_KEY: "", // API key from .env file
  OPENROUTER_MODEL: "deepseek/deepseek-chat-v3-0324:free", // Default model
  OPENROUTER_TIMEOUT: 60000, // 60 seconds timeout
  OPENROUTER_TEMPERATURE: 0.7, // Response randomness (0-1)
  OPENROUTER_MAX_TOKENS: 102400, // Max response length
  
  // Chutes Settings
  CHUTES_API_KEY: "", // Replace with your actual Chutes API key
  CHUTES_MODEL: "deepseek-ai/DeepSeek-V3-0324", // Default moto use
  CHUTES_TIMEOUT: 60000, // 60 seconds timeout
  CHUTES_TEMPERATURE: 0.7, // Response randomness (0-1)
  CHUTES_MAX_TOKENS: 2048, // Max response length
  
  // Gemini Settings
  GEMINI_MODEL: "gemma-3-27b-it", // gemini model to use
  

  
  // Feature Flags
  ENABLE_IMAGE_SUPPORT: false, // Enable support for image inputs, still needed some work as this shit dosnt work
  ENABLE_SERVER_SUPPORT: true, // Enable support for servers
  ENABLE_AI_EMOTIONS: true, // Enable AI emotions and mood
  ENABLE_RANDOM_IGNORE: true, // Enable random message ignoring for realism
  
  // Server Configuration
  ALLOWED_SERVERS: [
    {
      id: "344", // Replace with actual server ID
      name: "ddds",
      aliases: ["server", "server"],
      respond_to_all: false, // Only respond when mentioned if false
      keyword_triggers: ["d", "dddd","dddddd","cd","anyone online","dead chat",], // React to these words even without mention
      ignore_channels: ["bot-spam", "admin-only"] // Channels to ignore
    }
    // Add more servers as needed
  ],
  
  // Message Batching
  MESSAGE_BUFFER_TIMEOUT: 3000, // 3 seconds to batch messages
  
  // Typing Simulation
  MIN_TYPING_DELAY: 2000, // Minimum typing delay in ms
  MAX_TYPING_DELAY: 5000, // Maximum typing delay in ms
  
  // Status Simulation
  ACTIVE_HOURS_START: 7, // 7 AM
  ACTIVE_HOURS_END: 24, // 11 PM
  MAX_MESSAGES_PER_HOUR: 50, // Maximum messages per hour before "getting tired"
  
  // Debug Settings
  DEBUG_MODE: true, // Enable verbose logging
}; 
