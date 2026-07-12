import { exportJWK, generateKeyPair } from 'jose';

import type { GenerateKeyPairResult, createRemoteJWKSet } from 'jose';

type JWKSetFunction = ReturnType<typeof createRemoteJWKSet>;

export class MockOidcService {
  static readonly ISSUER = 'https://auth.example.com/';
  static readonly KEY_ID = 'mock-key-1';

  private privateKey!: GenerateKeyPairResult['privateKey'];
  private publicKey!: GenerateKeyPairResult['publicKey'];
  private jwksFunction!: JWKSetFunction;

  async setup(): Promise<void> {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    this.privateKey = privateKey;
    this.publicKey = publicKey;

    const jwk = await exportJWK(publicKey);
    jwk.kid = MockOidcService.KEY_ID;
    jwk.alg = 'RS256';
    jwk.use = 'sig';

    this.jwksFunction = (async () =>
      await Promise.resolve(this.publicKey)) as unknown as JWKSetFunction;
  }

  getPrivateKey(): GenerateKeyPairResult['privateKey'] {
    return this.privateKey;
  }

  getPublicKey(): GenerateKeyPairResult['publicKey'] {
    return this.publicKey;
  }

  getJWKSet(): JWKSetFunction {
    return this.jwksFunction;
  }

  getIssuer(): string {
    return MockOidcService.ISSUER;
  }

  isInitialized(): boolean {
    return true;
  }

  async init(): Promise<void> {
    return await Promise.resolve();
  }
}
