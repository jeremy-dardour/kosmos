function base64UrlEncode(str: string): string {
  return btoa(str)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll(/=+$/g, '');
}

// Generate a minimal JWT for development
export function generateFakeJwt(username: string, email: string): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: username,
    email,
    username,
    iat: now,
    exp: now + 3600, // 1 hour expiry
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode('fake-signature-for-dev');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
