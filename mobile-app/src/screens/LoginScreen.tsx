import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, SafeAreaView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { usePortal } from '../context/PortalContext';
import { PortalApiError, portalApi } from '../api/portalApi';

type LoginStep = 'document' | 'phone' | 'otp';
const OTP_RESEND_COOLDOWN_SECONDS = 60;

function normalizePhoneForOtp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone.trim();

  if (digits.startsWith('58') && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith('57') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;

  return digits.startsWith('+') ? digits : `+${digits}`;
}

export function LoginScreen() {
  const { loading, requestLoginOtp, verifyLoginOtp } = usePortal();
  const [step, setStep] = useState<LoginStep>('document');
  const [documentNumber, setDocumentNumber] = useState('');
  const [patientName, setPatientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    if (step !== 'otp' || resendCountdown <= 0) return;

    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [step, resendCountdown]);

  const handleLookupPatient = async () => {
    if (!documentNumber.trim()) {
      Alert.alert('Validación', 'Ingresa tu número de documento.');
      return;
    }

    try {
      const patient = await portalApi.searchPatient(documentNumber);
      if (!patient) {
        Alert.alert('No encontrado', 'No encontramos un paciente con ese documento.');
        return;
      }

      setPatientName(patient.name || 'Paciente');
      setPhoneNumber((patient.phone || '').replace(/^\+/, ''));
      setStep('phone');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo validar el documento.');
    }
  };

  const handleSendOtp = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Validación', 'Ingresa el número telefónico para enviar el OTP.');
      return;
    }

    try {
      const normalizedPhone = normalizePhoneForOtp(phoneNumber);
      const response = await requestLoginOtp(documentNumber, normalizedPhone);
      setMaskedPhone(response.masked_phone || 'su número registrado');
      setOtpCode('');
      setResendCountdown(response.resend_cooldown_seconds || OTP_RESEND_COOLDOWN_SECONDS);
      setStep('otp');
      Alert.alert('Código enviado', `Enviaremos un código OTP por SMS al número ${response.masked_phone}.`);
    } catch (error: any) {
      if (
        error instanceof PortalApiError &&
        error.status === 429 &&
        typeof error.retry_after_seconds === 'number'
      ) {
        setResendCountdown(error.retry_after_seconds);
        if (error.masked_phone) {
          setMaskedPhone(error.masked_phone);
        }
        setStep('otp');
        Alert.alert('Espera requerida', `Por seguridad, espera ${error.retry_after_seconds} segundos para reenviar.`);
        return;
      }
      Alert.alert('Error', error?.message || 'No se pudo enviar el OTP.');
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.trim().length < 4) {
      Alert.alert('Validación', 'Ingresa el código OTP recibido por SMS.');
      return;
    }

    try {
      await verifyLoginOtp(documentNumber, otpCode, rememberMe);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo verificar el OTP.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.loginContainer}>
        <View style={styles.brandBlock}>
          <Image source={require('../../assets/logo-biossanar.png')} style={styles.brandLogo} resizeMode="contain" />
          <Text style={styles.brandTitle}>Agenda Biossanar</Text>
          <Text style={styles.brandSubtitle}>Portal móvil de agendamiento</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ingreso de paciente</Text>
          {step === 'document' && (
            <>
              <TextInput
                value={documentNumber}
                onChangeText={setDocumentNumber}
                placeholder="Número de documento"
                keyboardType="numeric"
                style={styles.input}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={handleLookupPatient} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Continuar</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'phone' && (
            <>
              <Text style={styles.helperText}>Hola {patientName}. Para iniciar sesión enviaremos un código OTP de verificación por SMS.</Text>
              <Text style={styles.helperText}>Confirma o corrige el número donde quieres recibirlo:</Text>
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Ej: 3121234567"
                keyboardType="phone-pad"
                maxLength={15}
                style={styles.input}
              />

              <View style={styles.rememberRow}>
                <Text style={styles.rememberText}>Mantener sesión iniciada</Text>
                <Switch
                  value={rememberMe}
                  onValueChange={setRememberMe}
                  trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                  thumbColor={rememberMe ? '#2563eb' : '#f9fafb'}
                />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleSendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Enviar código OTP</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('document')}>
                <Text style={styles.secondaryButtonText}>Cambiar documento</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'otp' && (
            <>
              <Text style={styles.helperText}>Código enviado por SMS al número {maskedPhone}.</Text>
              <Text style={styles.countdownText}>
                {resendCountdown > 0
                  ? `Puedes reenviar un nuevo código en ${resendCountdown} segundos.`
                  : 'Ya puedes reenviar un nuevo código.'}
              </Text>
              {resendCountdown > 0 && (
                <Text style={styles.cooldownWarningText}>
                  {`Por seguridad, espera ${resendCountdown} segundos para reenviar.`}
                </Text>
              )}
              <TextInput
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder="Código OTP"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verificar e ingresar</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep('phone')}>
                <Text style={styles.secondaryButtonText}>Cambiar número</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, resendCountdown > 0 && styles.secondaryButtonDisabled]}
                onPress={handleSendOtp}
                disabled={resendCountdown > 0 || loading}
              >
                <Text style={styles.secondaryButtonText}>Reenviar código</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f4f6' },
  loginContainer: { flex: 1, justifyContent: 'center', padding: 20, gap: 14 },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 6,
  },
  brandLogo: {
    width: '100%',
    height: 95,
    marginBottom: 6,
  },
  brandTitle: { fontSize: 26, fontWeight: '800', color: '#1e3a8a', textAlign: 'center' },
  brandSubtitle: { fontSize: 14, color: '#4b5563', textAlign: 'center', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  rememberRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rememberText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
    paddingRight: 12,
    flex: 1,
  },
  helperText: {
    color: '#374151',
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  countdownText: {
    color: '#1d4ed8',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  cooldownWarningText: {
    color: '#b45309',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    marginTop: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 14,
  },
});
