import fs from 'fs';
import path from 'path';

let transporter: any | null = null;

function getTransporter(): any {
  if (transporter) return transporter;
  // Carga perezosa de nodemailer para evitar fallos cuando no está instalado
  let nodemailer: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nodemailer = require('nodemailer');
  } catch (e) {
    throw new Error('El módulo nodemailer no está instalado. Ejecuta "npm i nodemailer" en backend/ o desactiva MAIL_ENABLED=false.');
  }
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  if (!host || !user || !pass) {
    throw new Error('SMTP not configured');
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
}

export async function sendMail(options: { to: string; subject: string; text?: string; html?: string }) {
  const enabled = String(process.env.MAIL_ENABLED || 'false').toLowerCase() === 'true';
  if (!enabled) return { skipped: true };
  const fromName = process.env.MAIL_FROM_NAME;
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  const fromSingle = process.env.MAIL_FROM; // formato "Nombre <email@dominio>"
  const from = fromSingle || (fromEmail ? (fromName ? `${fromName} <${fromEmail}>` : fromEmail) : (process.env.SMTP_USER || 'no-reply@example.com'));
  const tx = getTransporter();
  const replyTo = process.env.MAIL_REPLY_TO;
  return tx.sendMail({ from, to: options.to, subject: options.subject, text: options.text, html: options.html, replyTo });
}

export async function sendAppointmentConfirmationEmail(params: {
  to: string;
  patientName?: string | null;
  doctorName?: string | null;
  specialtyName?: string | null;
  locationName?: string | null;
  scheduledAt: string; // yyyy-mm-dd HH:MM:SS
  appointmentType?: string | null;
}) {
  const { to, patientName, doctorName, specialtyName, locationName, scheduledAt, appointmentType } = params;
  const subject = process.env.MAIL_SUBJECT_APPOINTMENT_CONFIRMATION || 'Confirmación de cita médica';
  const brand = process.env.MAIL_BRAND || '';
  const supportPhone = process.env.MAIL_SUPPORT_PHONE || '';
  const supportEmail = process.env.MAIL_SUPPORT_EMAIL || '';
  const footerExtra = process.env.MAIL_FOOTER || '';
  const context = {
    brand,
    patientName,
    doctorName,
    specialtyName,
    locationName,
    scheduledAt,
    appointmentType,
    supportPhone,
    supportEmail,
    footer: footerExtra,
  } as Record<string, any>;

  const htmlTpl = process.env.MAIL_TEMPLATE_APPOINTMENT_CONFIRMATION_HTML || 'appointment_confirmation.html';
  const txtTpl = process.env.MAIL_TEMPLATE_APPOINTMENT_CONFIRMATION_TXT || 'appointment_confirmation.txt';

  try {
    const html = await renderTemplate(htmlTpl, context);
    const text = await renderTemplate(txtTpl, context);
    return sendMail({ to, subject, text, html });
  } catch {
    const lines: string[] = [];
    lines.push(`Hola${patientName ? ' ' + patientName : ''},`);
    lines.push('Tu cita ha sido agendada correctamente.');
    lines.push('');
    if (specialtyName) lines.push(`Especialidad: ${specialtyName}`);
    if (doctorName) lines.push(`Profesional: ${doctorName}`);
    lines.push(`Fecha y hora: ${scheduledAt}`);
    if (appointmentType) lines.push(`Modalidad: ${appointmentType}`);
    if (locationName) lines.push(`Lugar: ${locationName}`);
    lines.push('');
    lines.push('Si no reconoces esta cita o deseas modificarla, por favor comunícate con nosotros.');
    if (supportPhone) lines.push(`Teléfono de soporte: ${supportPhone}`);
    if (supportEmail) lines.push(`Correo de soporte: ${supportEmail}`);
    const text = lines.join('\n');
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111">
        <h2>Confirmación de cita médica${brand ? ' - ' + escapeHtml(brand) : ''}</h2>
        <p>Hola${patientName ? ' ' + escapeHtml(patientName) : ''},</p>
        <p>Tu cita ha sido agendada correctamente.</p>
        <ul>
          ${specialtyName ? `<li><strong>Especialidad:</strong> ${escapeHtml(specialtyName)}</li>` : ''}
          ${doctorName ? `<li><strong>Profesional:</strong> ${escapeHtml(doctorName)}</li>` : ''}
          <li><strong>Fecha y hora:</strong> ${escapeHtml(scheduledAt)}</li>
          ${appointmentType ? `<li><strong>Modalidad:</strong> ${escapeHtml(appointmentType!)}</li>` : ''}
          ${locationName ? `<li><strong>Lugar:</strong> ${escapeHtml(locationName)}</li>` : ''}
        </ul>
        <p>Si no reconoces esta cita o deseas modificarla, por favor comunícate con nosotros.</p>
        ${(supportPhone || supportEmail) ? `<p style="margin: 0.5rem 0 0">${supportPhone ? `Teléfono de soporte: ${escapeHtml(supportPhone)}` : ''}${supportPhone && supportEmail ? ' · ' : ''}${supportEmail ? `Correo de soporte: ${escapeHtml(supportEmail)}` : ''}</p>` : ''}
        ${footerExtra ? `<p style="margin-top: 1rem; color: #666; font-size: 12px;">${escapeHtml(footerExtra)}</p>` : ''}
      </div>
    `;
    return sendMail({ to, subject, text, html });
  }
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default {
  sendMail,
  sendAppointmentConfirmationEmail,
};

async function renderTemplate(filename: string, data: Record<string, any>): Promise<string> {
  const base = path.resolve(__dirname, '../templates');
  const filePath = path.join(base, filename);
  const content = await fs.promises.readFile(filePath, 'utf8');
  return simpleTemplate(content, data);
}

// Motor mínimo: soporta {{var}} y {{#if var}}...{{/if}}
function simpleTemplate(tpl: string, data: Record<string, any>): string {
  // bloques if
  tpl = tpl.replace(/\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_m, key, inner) => {
    const val = get(data, key);
    return val ? inner : '';
  });
  // variables simples
  tpl = tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const val = get(data, key);
    return val == null ? '' : String(val);
  });
  return tpl;
}

function get(obj: any, pathStr: string): any {
  return pathStr.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}
