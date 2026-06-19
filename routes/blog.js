const express = require('express');
const router = express.Router();
const multer = require('multer');
const { isAuthenticated, checkPermission } = require('../middleware/auth');
const { getCategories } = require('../services/wpService');
const { sendEmail } = require('../services/graphService');
const { jetpackEmail } = require('../config/wpConfig');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/blog', isAuthenticated, checkPermission, async (req, res, next) => {
  try {
    const categories = await getCategories();
    res.render('blog', {
      title: 'Publicar en Blog',
      currentPage: 'blog',
      categories
    });
  } catch (error) {
    next(error);
  }
});

router.post('/blog', isAuthenticated, checkPermission, upload.array('files', 5), async (req, res, next) => {
  try {
    const { title, content, categories, delay, status } = req.body;
    const files = req.files;

    // Build email body
    let body = content + '\n\n';
    if (categories) {
      const catArray = Array.isArray(categories) ? categories : [categories];
      body += `[category ${catArray.join(', ')}]\n`;
    }

    body += `[status ${status}]\n`;
    if (delay && delay > 0) {
      body += `[delay +${delay} hours]\n`;
    }

    // Prepare attachments
    const attachments = files.map(file => ({
      name: file.originalname,
      contentType: file.mimetype,
      contentBytes: file.buffer.toString('base64')
    }));

    // Send email
    const emailData = {
      to: jetpackEmail,
      subject: `BANDO: ${title}`,
      body: body,
      attachments: attachments
    };


    await sendEmail(req.session.accessToken, emailData);

    res.redirect('/blog');
  } catch (error) {
    console.error('Error in blog email post:', error);
    res.status(500).send('Error al enviar email para publicar: ' + error.message);
  }
});

module.exports = router;
