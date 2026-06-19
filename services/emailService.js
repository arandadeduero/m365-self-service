const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// Configure SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Sends a password reset email via AWS SES
 * @param {string} to - The recipient's email address
 * @param {string} resetUrl - The password reset URL
 */
async function sendResetEmail(to, resetUrl) {
  const params = {
    Source: process.env.FROM_EMAIL,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: 'Resetear contraseña de Microsoft 365',
        Charset: 'UTF-8',
      },
      Body: {
        Text: {
          Data: `Este es un correo automático. Puedes resetear tu contraseña para Microsoft365 aquí: ${resetUrl}`,
          Charset: 'UTF-8',
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);
    console.log('Reset email sent successfully. Message ID:', result.MessageId);
  } catch (error) {
    console.error('Error sending reset email:', error);
    throw new Error('Failed to send reset email');
  }
}

module.exports = { sendResetEmail };
