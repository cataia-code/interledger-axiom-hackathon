import { Resend } from 'resend';
import { config } from '../config/index.js';

// Mensajes enviados por el transport de consola; los tests los leen desde aquí.
export const outbox = [];

const consoleTransport = {
  async send(message) {
    outbox.push(message);
    if (outbox.length > 100) outbox.shift();
    if (config.env !== 'test') {
      console.log(`[mail] to=${message.to} subject="${message.subject}"\n${message.text}`);
    }
  },
};

function createResendTransport() {
  const resend = new Resend(config.resendApiKey);
  return {
    async send({ to, subject, text }) {
      const { error } = await resend.emails.send({ from: config.mailFrom, to, subject, text });
      if (error) throw new Error(`Resend error: ${error.message}`);
    },
  };
}

export const mailer =
  config.env === 'production' && config.resendApiKey ? createResendTransport() : consoleTransport;

const subjects = {
  'sign-in': 'Tu código para iniciar sesión',
  'email-verification': 'Verifica tu correo',
  'forget-password': 'Código para restablecer tu contraseña',
};

export function sendOtpEmail({ email, otp, type }) {
  return mailer.send({
    to: email,
    subject: subjects[type] ?? 'Tu código de verificación',
    text: `Tu código es ${otp}. Caduca en 10 minutos. Si no lo pediste, ignora este correo.`,
    type,
    otp,
  });
}
