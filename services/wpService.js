/**
 * WordPress Service
 * Handles interaction with WordPress REST API
 */
const axios = require('axios');

// Ensure required environment variables are set
if (!process.env.WP_URL || !process.env.WP_USER || !process.env.WP_APP_PASSWORD) {
  console.error('Missing WordPress configuration in .env');
}

const wpAuth = Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64');
const wpInstance = axios.create({
  baseURL: `${process.env.WP_URL}/wp-json/wp/v2`,
  headers: {
    Authorization: `Basic ${wpAuth}`,
    'User-Agent': 'M365-App-Integration'
  }
});

async function getCategories() {
  try {
    const response = await wpInstance.get('/categories');
    return response.data.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching WP categories:', error.response?.data || error.message);
    return [];
  }
}

module.exports = { getCategories };
