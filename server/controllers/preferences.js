import express from 'express';
import User from '../models/User.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/preferences - Fetch user preferences
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ clerkId: req.userId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      preferences: user.preferences || { theme: 'system' }
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PATCH /api/preferences - Update user preferences
router.patch('/', authMiddleware, async (req, res) => {
  try {
    const { theme } = req.body;

    // Validate theme value
    if (theme && !['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({ error: 'Invalid theme value' });
    }

    const user = await User.findOne({ clerkId: req.userId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update preferences
    if (theme) {
      user.preferences = user.preferences || {};
      user.preferences.theme = theme;
    }

    await user.save();

    res.json({
      preferences: user.preferences,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;