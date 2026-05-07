const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false, // true for port 465, false for 587
    auth: {
      user: process.env.EMAIL_USER, // aacoders@aaca.gov.et
      pass: process.env.EMAIL_PASS, // App password or user password
    },
  });

  let mailOptions = {
    from: `"Ethio Coders" <${process.env.EMAIL_USER}>`,
    subject,
    html,
  };

  // Handle multiple recipients
  if (Array.isArray(to) && to.length > 1) {
    mailOptions.to = process.env.EMAIL_USER;
    mailOptions.bcc = to.join(", ");
  } else {
    mailOptions.to = Array.isArray(to) ? to[0] : to;
  }

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
