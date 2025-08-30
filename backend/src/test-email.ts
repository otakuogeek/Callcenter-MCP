import { sendPatientRegistrationEmail } from './utils/emailService';

const testEmail = async () => {
  const testPatient = {
    id: 12345,
    name: 'Juan Pérez Demo',
    email: 'test-x00tj2hpl@srv1.mail-tester.com',
    document: '1234567890',
    phone: '+57 300 123 4567',
    birthDate: '1990-05-15',
    gender: 'Masculino',
    address: 'Calle 123 #45-67',
    eps: 'EPS Sura'
  };

  try {
    console.log('Enviando correo de prueba a mail-tester...');
    const result = await sendPatientRegistrationEmail(testPatient);
    console.log('Resultado del envío:', result);
  } catch (error) {
    console.error('Error al enviar correo:', error);
  }
};

testEmail();
