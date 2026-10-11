/**
 * Directory Routes
 *
 * - GET /directorio - everybody with their contact details
 * - GET /directorio/export.csv - the same, for Excel
 * - GET /directorio/:id - one person's contact card, with a QR code
 * - GET /directorio/:id/vcard - that card as a file for the phone or Outlook
 */

const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const appConfig = require('../config/appConfig');
const { isAuthenticated } = require('../middleware/auth');
const { userError } = require('../middleware/errorHandler');
const { getAllUsers, getUserById } = require('../services/graphService');
const { buildVCard, vcardFileName, directoryCsv } = require('../services/vcard');

// Only a directory id goes into a Graph URL
const DIRECTORY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The person of the URL, or a 404
 */
async function loadPerson(req) {
  if (!DIRECTORY_ID.test(req.params.id)) {
    throw userError(404, 'No hay nadie con ese identificador.');
  }
  const user = await getUserById(req.session.accessToken, req.params.id);
  if (!user) {
    throw userError(404, 'No hay nadie con ese identificador.');
  }
  return user;
}

/**
 * GET /directorio
 * Staff directory - everybody in the organization with their contact details
 */
router.get('/directorio', isAuthenticated, async (req, res, next) => {
  try {
    const users = await getAllUsers(req.session.accessToken);

    res.render('directory', {
      title: 'Directorio',
      currentPage: 'directory',
      users,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /directorio/export.csv
 * The directory as a spreadsheet
 */
router.get('/directorio/export.csv', isAuthenticated, async (req, res, next) => {
  try {
    const users = await getAllUsers(req.session.accessToken);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="directorio.csv"');
    res.send(directoryCsv(users));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /directorio/:id
 * One person's card: details, a QR code the phone reads as a contact, and
 * the vCard to download
 */
router.get('/directorio/:id', isAuthenticated, async (req, res, next) => {
  try {
    const person = await loadPerson(req);
    const vcard = buildVCard(person, appConfig.ORG_NAME);
    // A data: image, so nothing is asked of any other server
    const qr = await QRCode.toDataURL(vcard, { errorCorrectionLevel: 'M', margin: 1, width: 220 });

    res.render('contact-card', {
      title: person.displayName || 'Contacto',
      currentPage: 'directory',
      person,
      phones: [...(person.businessPhones || []), person.mobilePhone].filter(Boolean),
      qr,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /directorio/:id/vcard
 * The card as a .vcf file
 */
router.get('/directorio/:id/vcard', isAuthenticated, async (req, res, next) => {
  try {
    const person = await loadPerson(req);
    res.set('Content-Type', 'text/vcard; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${vcardFileName(person)}"`);
    res.send(buildVCard(person, appConfig.ORG_NAME));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
