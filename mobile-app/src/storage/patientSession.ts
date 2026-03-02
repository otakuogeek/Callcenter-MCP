import AsyncStorage from '@react-native-async-storage/async-storage';

const PATIENT_SESSION_KEY = 'biosanar_patient_session_v1';

type StoredPatientSession = {
  remember: boolean;
  document: string;
};

function normalizeDocument(document: string): string {
  return document.trim().replace(/\s+/g, '').replace(/[.-]/g, '').toUpperCase();
}

export async function savePatientSession(document: string): Promise<void> {
  const payload: StoredPatientSession = {
    remember: true,
    document: normalizeDocument(document),
  };
  await AsyncStorage.setItem(PATIENT_SESSION_KEY, JSON.stringify(payload));
}

export async function loadPatientSession(): Promise<StoredPatientSession | null> {
  const raw = await AsyncStorage.getItem(PATIENT_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredPatientSession;
    if (!parsed?.remember || !parsed?.document) {
      return null;
    }
    return {
      remember: true,
      document: normalizeDocument(parsed.document),
    };
  } catch {
    return null;
  }
}

export async function clearPatientSession(): Promise<void> {
  await AsyncStorage.removeItem(PATIENT_SESSION_KEY);
}
