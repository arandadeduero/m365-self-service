/**
 * Main Application Routes
 * 
 * Handles the main pages of the application:
 * - / (home) - Profile page (requires authentication)
 * - /login - Login page
 */

const express = require('express');
const router = express.Router();
const { isAuthenticated, redirectIfAuthenticated } = require('../middleware/auth');
const { getAllUserData } = require('../services/graphService');

/**
 * GET /
 * Home page - displays user profile (requires authentication)
 */
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    // Get access token from session
    const accessToken = req.session.accessToken;

    // Fetch all user data from Microsoft Graph
    const userData = await getAllUserData(accessToken);

    // Convert photo buffer to base64 for display in HTML
    let photoBase64 = null;
    if (userData.photo) {
      photoBase64 = `data:image/jpeg;base64,${userData.photo.toString('base64')}`;
    }

    // Render profile page with user data
    res.render('profile', {
      title: 'Profile',
      user: userData.profile,
      photo: photoBase64,
      groups: userData.groups,
      manager: userData.manager,
      // Pass raw JSON for display
      rawJson: JSON.stringify({
        profile: userData.profile,
        groups: userData.groups,
        manager: userData.manager,
      }, null, 2),
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    // If token is expired or invalid, clear session and redirect to login
    if (error.message.includes('token') || error.message.includes('unauthorized')) {
      req.session.destroy(() => {
        res.redirect('/login');
      });
    } else {
      next(error);
    }
  }
});

/**
 * GET /login
 * Login page (redirects to home if already authenticated)
 */
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('login', {
    title: 'Sign In',
  });
});

module.exports = router;
