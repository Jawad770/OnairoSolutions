const nodemailer = require("nodemailer");
const config = require("./config");

const smtpReady = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

const transporter = smtpReady
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

async function sendMail({ to, subject, text }) {
  if (!transporter || !to) return false;
  await transporter.sendMail({ from: config.smtp.from, to, subject, text });
  return true;
}

module.exports = { sendMail, smtpReady };
