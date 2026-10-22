const express = require('express');
const router = express.Router();
const mediaRoutes = require('./media');

// Mount media routes
router.use('/media', mediaRoutes);

module.exports = router;