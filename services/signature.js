/**
 * Email signature
 *
 * Builds the organization's signature for a person from their profile, as
 * HTML (tables and inline styles, which is what mail programs keep) and as
 * plain text. Pure functions.
 */

const escapeHtml = (text) => String(text == null ? '' : text).replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

/**
 * The signature of a person
 * @param {Object} profile - Graph user: displayName, jobTitle, department, businessPhones, mobilePhone, mail
 * @param {Object} org - orgName, orgWeb, orgAddress
 * @returns {{ html: string, text: string, lines: Array<string> }}
 */
function buildSignature(profile, { orgName, orgWeb, orgAddress }) {
  const name = profile.displayName || profile.mail || '';
  const phones = [...(profile.businessPhones || []), profile.mobilePhone].filter(Boolean);
  const email = profile.mail || profile.userPrincipalName || '';
  const web = orgWeb ? orgWeb.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';

  const lines = [
    name,
    profile.jobTitle,
    profile.department,
    orgName,
    orgAddress,
    phones.length ? `Tel. ${phones.join(' · ')}` : null,
    email,
    web,
  ].filter(Boolean);

  const row = (content, style = '') => `<tr><td style="padding:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#333333;${style}">${content}</td></tr>`;
  const rows = [
    row(escapeHtml(name), 'font-size:15px;font-weight:bold;color:#184a8b;'),
    profile.jobTitle ? row(escapeHtml(profile.jobTitle)) : '',
    profile.department ? row(escapeHtml(profile.department)) : '',
    row(escapeHtml(orgName), 'font-weight:bold;padding-top:6px;'),
    orgAddress ? row(escapeHtml(orgAddress)) : '',
    phones.length ? row(`Tel. ${escapeHtml(phones.join(' · '))}`) : '',
    email ? row(`<a href="mailto:${escapeHtml(email)}" style="color:#184a8b;text-decoration:none;">${escapeHtml(email)}</a>`) : '',
    web ? row(`<a href="${escapeHtml(orgWeb)}" style="color:#184a8b;text-decoration:none;">${escapeHtml(web)}</a>`) : '',
  ].join('');

  const html = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-left:3px solid #184a8b;padding-left:10px;"><tbody>${rows}</tbody></table>`;
  return { html, text: lines.join('\n'), lines };
}

module.exports = { buildSignature };
