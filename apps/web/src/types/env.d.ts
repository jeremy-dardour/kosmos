interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly MODE: 'development' | 'production';
  readonly DEV: true | false;
  readonly PROD: true | false;
  readonly VITE_FAKE_AUTH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
