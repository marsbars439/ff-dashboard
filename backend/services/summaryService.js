const OpenAI = require('openai');

// Initialize OpenAI client using API key from environment variables
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate a short summary for provided data using an LLM.
 * @param {any} data - Data to summarize. Can be string or object.
 * @returns {Promise<string>} Summary text
 */
async function generateSummary(data) {
  try {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: `Summarize the following data:\n${content}` }
      ]
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating summary:', error.message);
    throw new Error('Failed to generate summary');
  }
}

module.exports = { generateSummary };

