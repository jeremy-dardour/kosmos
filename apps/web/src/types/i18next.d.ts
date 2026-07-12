import 'react-i18next';
import type { Resources } from './i18n';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: Resources;
  }
}
