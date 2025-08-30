import { createTransport } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

// Configuración del transportador de correo
const transporter = createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail'
});

interface PatientData {
    id: number;
    name: string;
    email: string;
    document: string;
    phone?: string;
    birthDate?: string;
    gender?: string;
    address?: string;
    eps?: string;
}

export const sendPatientRegistrationEmail = async (patient: PatientData) => {
    try {
        const emailContent = `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #004d99; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .info-table td { padding: 8px; border: 1px solid #ddd; }
                    .info-table td:first-child { font-weight: bold; width: 40%; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>BioSanar Call - Registro Exitoso</h1>
                    </div>
                    <div class="content">
                        <h2>¡Bienvenido/a ${patient.name}!</h2>
                        <p>Gracias por registrarte en nuestro sistema médico. A continuación, encontrarás los detalles de tu registro:</p>
                        
                        <table class="info-table">
                            <tr>
                                <td>Nombre Completo:</td>
                                <td>${patient.name}</td>
                            </tr>
                            <tr>
                                <td>Documento:</td>
                                <td>${patient.document}</td>
                            </tr>
                            <tr>
                                <td>Correo Electrónico:</td>
                                <td>${patient.email}</td>
                            </tr>
                            ${patient.phone ? `
                            <tr>
                                <td>Teléfono:</td>
                                <td>${patient.phone}</td>
                            </tr>` : ''}
                            ${patient.birthDate ? `
                            <tr>
                                <td>Fecha de Nacimiento:</td>
                                <td>${patient.birthDate}</td>
                            </tr>` : ''}
                            ${patient.gender ? `
                            <tr>
                                <td>Género:</td>
                                <td>${patient.gender}</td>
                            </tr>` : ''}
                            ${patient.eps ? `
                            <tr>
                                <td>EPS:</td>
                                <td>${patient.eps}</td>
                            </tr>` : ''}
                        </table>

                        <p>Por favor, guarda esta información para futura referencia. Tu ID de paciente es: <strong>${patient.id}</strong></p>
                        
                        <p>Recuerda que puedes:</p>
                        <ul>
                            <li>Agendar citas médicas</li>
                            <li>Ver tu historial médico</li>
                            <li>Actualizar tu información personal</li>
                            <li>Consultar resultados de exámenes</li>
                        </ul>
                    </div>
                    <div class="footer">
                        <p>Este es un correo automático, por favor no responder.</p>
                        <p>BioSanar Call &copy; 2025. Todos los derechos reservados.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Crear versión texto plano del mensaje
        const textContent = `
Bienvenido/a ${patient.name},

Gracias por registrarte en nuestro sistema médico. A continuación, encontrarás los detalles de tu registro:

Información del Paciente:
- Nombre Completo: ${patient.name}
- Documento: ${patient.document}
- Correo Electrónico: ${patient.email}
${patient.phone ? `- Teléfono: ${patient.phone}` : ''}
${patient.birthDate ? `- Fecha de Nacimiento: ${patient.birthDate}` : ''}
${patient.gender ? `- Género: ${patient.gender}` : ''}
${patient.eps ? `- EPS: ${patient.eps}` : ''}

Tu ID de paciente es: ${patient.id}

Servicios disponibles:
- Agendar citas médicas
- Ver tu historial médico
- Actualizar tu información personal
- Consultar resultados de exámenes

Este es un correo automático, por favor no responder.
BioSanar Call © 2025. Todos los derechos reservados.
`.trim();

        const mailOptions = {
            from: 'BioSanar Call <noreply@biosanarcall.site>',
            to: patient.email,
            subject: 'Bienvenido a BioSanar Call - Registro Exitoso',
            text: textContent,
            html: emailContent,
            headers: {
                'X-Priority': '1',
                'X-MSMail-Priority': 'High',
                'Importance': 'high',
                'Message-ID': `<${Date.now()}.${patient.id}@biosanarcall.site>`,
                'X-Mailer': 'Microsoft-BioSanar-Client',
                'X-MimeOLE': 'Produced By BioSanar Call System',
                'List-Unsubscribe': `<mailto:unsubscribe@biosanarcall.site?subject=unsubscribe-${patient.id}>`,
                'Feedback-ID': `${patient.id}:biosanarcall:${Date.now()}`,
                'Auto-Submitted': 'auto-generated'
            },
            messageId: `<${Date.now()}.${patient.id}@biosanarcall.site>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Correo de registro enviado:', info.response);
        return true;
    } catch (error) {
        console.error('Error al enviar correo de registro:', error);
        return false;
    }
};
