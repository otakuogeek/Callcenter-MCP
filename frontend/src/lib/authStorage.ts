const ADMIN_TOKEN_KEY = 'token';
const ADMIN_USER_KEY = 'user';
const ADMIN_AUTH_KEY = 'isAuthenticated';

const DOCTOR_TOKEN_KEY = 'doctorToken';
const DOCTOR_USER_KEY = 'doctor';
const DOCTOR_AUTH_KEY = 'isDoctorAuthenticated';

function decodeJwtPayload(token: string): { exp?: number; type?: string } | null {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    return JSON.parse(atob(payloadBase64));
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= Date.now();
}

export function isDoctorJwt(token: string): boolean {
  const payload = decodeJwtPayload(token);
  return payload?.type === 'doctor';
}

export function setAdminSession(token: string, user: unknown): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  localStorage.setItem(ADMIN_AUTH_KEY, 'true');
}

export function clearAdminSession(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
  localStorage.removeItem(ADMIN_AUTH_KEY);
}

export function getAdminToken(): string | null {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return null;

  if (isJwtExpired(token)) {
    clearAdminSession();
    return null;
  }

  return token;
}

export function hasAdminSession(): boolean {
  return Boolean(getAdminToken());
}

export function setDoctorSession(token: string, doctor: unknown): void {
  localStorage.setItem(DOCTOR_TOKEN_KEY, token);
  localStorage.setItem(DOCTOR_USER_KEY, JSON.stringify(doctor));
  localStorage.setItem(DOCTOR_AUTH_KEY, 'true');
}

export function clearDoctorSession(): void {
  localStorage.removeItem(DOCTOR_TOKEN_KEY);
  localStorage.removeItem(DOCTOR_USER_KEY);
  localStorage.removeItem(DOCTOR_AUTH_KEY);
}

export function getDoctorToken(): string | null {
  const token = localStorage.getItem(DOCTOR_TOKEN_KEY);
  if (!token) return null;

  if (isJwtExpired(token) || !isDoctorJwt(token)) {
    clearDoctorSession();
    return null;
  }

  return token;
}

export function hasDoctorSession(): boolean {
  return Boolean(getDoctorToken());
}