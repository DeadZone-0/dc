/**
 * Colab AI integration module
 * Handles all interactions with the Colab-hosted AI via Gradio API
 */
const axios = require('axios');
const settings = require('../settings');
const dashboard = require('../dashboard/server');

/**
 * Ask Colab AI for a response
 * @param {string} prompt - The text prompt to send to Colab
 * @param {Buffer} imageBuffer - Optional image data to include with the prompt
 * @param {string} userId - User ID for potential per-user customization
 * @param {string} systemInstruction - System instruction to prepend to the prompt
 * @returns {Promise<string>} - The text response from Colab AI
 */
async function askColab(prompt, imageBuffer = null, userId = null, systemInstruction = null) {
  try {
    dashboard.logActivity('Colab AI is thinking...');
    
    // For Colab, we need to include the system instruction directly in the prompt
    // since it doesn't support separate system instructions like Gemini
    let fullPrompt = prompt;
    if (systemInstruction) {
      fullPrompt = `${systemInstruction}\n\n${prompt}`;
      if (settings.DEBUG_MODE) {
        console.log('Colab: Added system instruction to prompt');
      }
    }
    
    // Prepare the request data
    // Note: Using FormData from 'form-data' package for Node.js environment
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('text', fullPrompt);
    
    // Add image if provided and enabled
    if (settings.ENABLE_IMAGE_SUPPORT && imageBuffer) {
      formData.append('image', imageBuffer, {
        filename: 'image.png',
        contentType: 'image/png'
      });
    }
    
    // Make the API call to Colab
    const response = await axios.post(settings.COLAB_URL, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: settings.COLAB_TIMEOUT
    });
    
    // Process and sanitize the response
    if (response.data && typeof response.data === 'object') {
      // Gradio typically returns data in a specific format
      // This may need adjustment based on your actual Gradio API response structure
      return response.data.data || response.data.output || response.data.text || '';
    } else if (typeof response.data === 'string') {
      return response.data.trim();
    }
    
    throw new Error('Unexpected response format from Colab');
  } catch (err) {
    console.error('Colab API error:', err.message);
    dashboard.logActivity('Colab API error: ' + err.message);
    throw new Error(`Colab error: ${err.message}`);
  }
}

module.exports = {
  askColab
}; 