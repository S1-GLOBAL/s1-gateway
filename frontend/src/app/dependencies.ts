import { HttpAccountsGateway, type AccountsGateway } from '@/features/accounts';
import {
  BrowserThemeDocument,
  LocalStorageThemePreferenceStore,
  browserLocalStorage,
  type ThemeDocument,
  type ThemePreferenceStore,
} from '@/features/appearance';
import { HttpToolsGateway, type ToolsGateway } from '@/features/tools';
import { createHttpClient } from '@/shared/infrastructure/http-client';

/** Every port's production adapter, chosen in one place. */
export interface Dependencies {
  accountsGateway: AccountsGateway;
  toolsGateway: ToolsGateway;
  themeStore: ThemePreferenceStore;
  themeDocument: ThemeDocument;
}

export function createDependencies(): Dependencies {
  const http = createHttpClient(import.meta.env.VITE_API_URL ?? '/api/v1');
  return {
    accountsGateway: new HttpAccountsGateway(http),
    toolsGateway: new HttpToolsGateway(http),
    themeStore: new LocalStorageThemePreferenceStore(browserLocalStorage()),
    themeDocument: new BrowserThemeDocument(),
  };
}