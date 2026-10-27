import { HttpAccountsGateway, type AccountsGateway } from '@/features/accounts';
import { HttpAtlasGateway, HttpSuggestionsGateway, type AtlasGateway, type SuggestionsGateway } from '@/features/atlas';
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
  atlasGateway: AtlasGateway;
  suggestionsGateway: SuggestionsGateway;
  toolsGateway: ToolsGateway;
  themeStore: ThemePreferenceStore;
  themeDocument: ThemeDocument;
}

export function createDependencies(): Dependencies {
  const http = createHttpClient(import.meta.env.VITE_API_URL ?? '/api/v1');
  return {
    accountsGateway: new HttpAccountsGateway(http),
    atlasGateway: new HttpAtlasGateway(http),
    suggestionsGateway: new HttpSuggestionsGateway(http),
    toolsGateway: new HttpToolsGateway(http),
    themeStore: new LocalStorageThemePreferenceStore(browserLocalStorage()),
    themeDocument: new BrowserThemeDocument(),
  };
}