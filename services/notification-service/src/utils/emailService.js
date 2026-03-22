const nodemailer = require("nodemailer");
const path = require("path");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const logoPath = path.join(__dirname, "UniLibLogo.png");

const logoHeader = `
  <div style="background-color: #163b63; padding: 28px 24px; border-radius: 16px 16px 0 0; text-align: center;">
    <table cellpadding="0" cellspacing="0" border="0" align="center">
      <tr>
        <td style="vertical-align: middle; padding-right: 12px;">
          <img src="cid:uniliblogo" alt="UniLib" style="width: 48px; height: auto; border-radius: 8px;" />
        </td>
        <td style="vertical-align: middle;">
          <span style="color: white; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; font-family: Georgia, 'Times New Roman', serif;">UniLib</span>
          <br/>
          <span style="color: rgba(255,255,255,0.7); font-size: 12px; font-family: Arial, sans-serif;">University Library System</span>
        </td>
      </tr>
    </table>
  </div>
`;

const footer = `
  <div style="padding: 20px 24px; background-color: #f1f0ed; border-radius: 0 0 16px 16px; text-align: center; border-top: 1px solid #dfd9cf;">
    <p style="color: #6b7280; font-size: 12px; margin: 0;">This is an automated email from UniLib Library System.</p>
    <p style="color: #6b7280; font-size: 12px; margin: 4px 0 0 0;">Please do not reply to this email.</p>
  </div>
`;

const wrapEmail = (content) => `
  <div style="font-family: Arial, 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
      ${logoHeader}
      <div style="background-color: #faf9f6; padding: 32px 28px; border-left: 1px solid #dfd9cf; border-right: 1px solid #dfd9cf;">
        ${content}
      </div>
      ${footer}
    </div>
  </div>
`;

const emailTemplates = {
  borrow_confirmation: (bookTitle, dueDate, userName) => ({
    subject: `Borrow Confirmation - "${bookTitle}"`,
    html: wrapEmail(`
      <h2 style="color: #163b63; margin: 0 0 8px 0; font-size: 22px; font-family: Georgia, serif;">Borrow Confirmation</h2>
      <div style="width: 40px; height: 3px; background-color: #163b63; border-radius: 2px; margin-bottom: 20px;"></div>
      <p style="color: #203245; font-size: 16px; line-height: 1.6;">Hello <strong>${userName}</strong>,</p>
      <p style="color: #203245; font-size: 16px; line-height: 1.6;">You have successfully borrowed the following book:</p>
      <div style="margin: 20px 0; padding: 20px; background-color: #e8eef5; border-radius: 12px; border-left: 4px solid #163b63;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding-bottom: 8px;">
              <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Book Title</span><br/>
              <span style="color: #163b63; font-size: 18px; font-weight: 700;">${bookTitle}</span>
            </td>
          </tr>
          ${dueDate ? `<tr>
            <td>
              <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Due Date</span><br/>
              <span style="color: #163b63; font-size: 16px; font-weight: 600;">${dueDate}</span>
            </td>
          </tr>` : ""}
        </table>
      </div>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">Please return the book before the due date to avoid overdue penalties. Happy reading!</p>
    `),
  }),

  borrow_activity_alert: (bookTitle, dueDate, userName, metadata = {}) => ({
    subject: `Borrow Activity Alert - "${bookTitle}"`,
    html: wrapEmail(`
      <h2 style="color: #163b63; margin: 0 0 8px 0; font-size: 22px; font-family: Georgia, serif;">Borrow Activity Alert</h2>
      <div style="width: 40px; height: 3px; background-color: #163b63; border-radius: 2px; margin-bottom: 20px;"></div>
      <p style="color: #203245; font-size: 16px; line-height: 1.6;">Hello <strong>${userName}</strong>,</p>
      <p style="color: #203245; font-size: 16px; line-height: 1.6;">A new borrowing activity has been recorded in UniLib.</p>
      <div style="margin: 20px 0; padding: 20px; background-color: #e8eef5; border-radius: 12px; border-left: 4px solid #163b63;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding-bottom: 8px;">
              <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Borrower</span><br/>
              <span style="color: #163b63; font-size: 18px; font-weight: 700;">${metadata.borrowerName || "A library member"}</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 8px;">
              <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Book Title</span><br/>
              <span style="color: #163b63; font-size: 18px; font-weight: 700;">${bookTitle}</span>
            </td>
          </tr>
          ${dueDate ? `<tr>
            <td>
              <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Due Date</span><br/>
              <span style="color: #163b63; font-size: 16px; font-weight: 600;">${dueDate}</span>
            </td>
          </tr>` : ""}
        </table>
      </div>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">This alert was sent to keep staff and administrators informed about borrowing activity.</p>
    `),
  }),

  return_confirmation: (bookTitle, dueDate, userName) => ({
    subject: `Return Confirmation - "${bookTitle}"`,
    html: wrapEmail(`
      <h2 style="color: #163b63; margin: 0 0 8px 0; font-size: 22px; font-family: Georgia, serif;">Return Confirmation</h2>
      <div style="width: 40px; height: 3px; background-color: #16a34a; border-radius: 2px; margin-bottom: 20px;"></div>
      <p style="color: #203245; font-size: 16px; line-height: 1.6;">Hello <strong>${userName}</strong>,</p>
      <p style="color: #203245; font-size: 16px; line-height: 1.6;">You have successfully returned the following book:</p>
      <div style="margin: 20px 0; padding: 20px; background-color: #f0fdf4; border-radius: 12px; border-left: 4px solid #16a34a;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td>
              <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Book Title</span><br/>
              <span style="color: #15803d; font-size: 18px; font-weight: 700;">${bookTitle}</span>
            </td>
          </tr>
        </table>
      </div>
      <div style="margin: 20px 0; padding: 16px; background-color: #f7f7f5; border-radius: 10px; text-align: center;">
        <span style="color: #16a34a; font-size: 28px;">&#10003;</span>
        <p style="color: #203245; font-size: 14px; margin: 8px 0 0 0;">Book returned successfully. Thank you!</p>
      </div>
    `),
  }),

  due_reminder: (bookTitle, dueDate, userName) => ({
    subject: `Due Date Reminder - "${bookTitle}"`,
    html: wrapEmail(`
      <h2 style="color: #92400e; margin: 0 0 8px 0; font-size: 22px; font-family: Georgia, serif;">Due Date Reminder</h2>
      <div style="width: 40px; height: 3px; background-color: #f59e0b; border-radius: 2px; margin-bottom: 20px;"></div>
      <p style="color: #203245; font-size: 16px; line-height: 1.6;">Hello <strong>${userName}</strong>,</p>
      <p style="color: #203245; font-size: 16px; line-height: 1.6;">This is a friendly reminder that the following book is <strong>due soon</strong>:</p>
      <div style="margin: 20px 0; padding: 20px; background-color: #fffbeb; border-radius: 12px; border-left: 4px solid #f59e0b;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding-bottom: 8px;">
              <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Book Title</span><br/>
              <span style="color: #92400e; font-size: 18px; font-weight: 700;">${bookTitle}</span>
            </td>
          </tr>
          ${dueDate ? `<tr>
            <td>
              <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Due Date</span><br/>
              <span style="color: #92400e; font-size: 16px; font-weight: 600;">${dueDate}</span>
            </td>
          </tr>` : ""}
        </table>
      </div>
      <div style="margin: 20px 0; padding: 16px; background-color: #fef3c7; border-radius: 10px; text-align: center;">
        <p style="color: #92400e; font-size: 14px; font-weight: 600; margin: 0;">Please return the book on time to avoid overdue penalties.</p>
      </div>
    `),
  }),

  overdue_alert: (bookTitle, dueDate, userName) => ({
    subject: `OVERDUE ALERT - "${bookTitle}"`,
    html: wrapEmail(`
      <h2 style="color: #991b1b; margin: 0 0 8px 0; font-size: 22px; font-family: Georgia, serif;">Overdue Alert</h2>
      <div style="width: 40px; height: 3px; background-color: #dc2626; border-radius: 2px; margin-bottom: 20px;"></div>
      <p style="color: #203245; font-size: 16px; line-height: 1.6;">Hello <strong>${userName}</strong>,</p>
      <p style="color: #203245; font-size: 16px; line-height: 1.6;">The following book is <strong style="color: #dc2626;">overdue</strong>:</p>
      <div style="margin: 20px 0; padding: 20px; background-color: #fef2f2; border-radius: 12px; border-left: 4px solid #dc2626;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td>
              <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Book Title</span><br/>
              <span style="color: #991b1b; font-size: 18px; font-weight: 700;">${bookTitle}</span>
            </td>
          </tr>
        </table>
      </div>
      <div style="margin: 20px 0; padding: 16px; background-color: #dc2626; border-radius: 10px; text-align: center;">
        <p style="color: white; font-size: 14px; font-weight: 600; margin: 0;">This book is past its due date. Please return it immediately.</p>
      </div>
    `),
  }),
};

const sendNotificationEmail = async (toEmail, type, bookTitle, dueDate, userName, metadata = {}) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("Email not configured. Skipping email notification.");
    return;
  }

  const templateFn = emailTemplates[type];
  if (!templateFn) {
    console.log(`No email template for type: ${type}`);
    return;
  }

  const { subject, html } = templateFn(bookTitle || "a book", dueDate, userName || "User", metadata);

  try {
    await transporter.sendMail({
      from: `"UniLib Library" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      html,
      attachments: [
        {
          filename: "UniLibLogo.png",
          path: logoPath,
          cid: "uniliblogo",
        },
      ],
    });
    console.log(`Email sent to ${toEmail} for ${type}`);
  } catch (error) {
    console.error(`Failed to send email to ${toEmail}:`, error.message);
  }
};

module.exports = { sendNotificationEmail };
