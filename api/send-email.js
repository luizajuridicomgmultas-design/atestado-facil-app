import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { fileName, pdfBase64, userName, userEmail } = req.body || {};

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.EMAIL_TO) {
      return res.status(500).json({
        error: "Variáveis de e-mail não configuradas na Vercel. Confira EMAIL_USER, EMAIL_PASS e EMAIL_TO.",
      });
    }

    if (!fileName || !pdfBase64 || !userName) {
      return res.status(400).json({
        error: "Dados incompletos para envio. O PDF, o nome do arquivo ou o nome do usuário não chegou na API.",
      });
    }

    const cleanPass = String(process.env.EMAIL_PASS).replace(/\s/g, "");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: cleanPass,
      },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `Atestado Fácil <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      replyTo: userEmail || process.env.EMAIL_USER,
      subject: `Formulário Solicitação Perícia Médica - ${userName}`,
      text: `Olá, segue em anexo o Formulário Solicitação Perícia Médica de ${userName}.`,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf",
        },
      ],
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro ao enviar email:", error);

    return res.status(500).json({
      error: error?.message || "Erro ao enviar email",
      code: error?.code || null,
      command: error?.command || null,
    });
  }
}