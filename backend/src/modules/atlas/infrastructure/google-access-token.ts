import { createSign } from 'node:crypto';
import { ReviewSheetSyncError } from '../application/ports/review-spreadsheet.js';

/** A Google Cloud service account's key, as its JSON key file gives it (plan 0016). */
export interface ServiceAccountKey {
  readonly clientEmail: string;
  readonly privateKey: string;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
/** Only the spreadsheets shared with the service account: never the rest of anyone's Drive. */
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function base64url(text: string): string {
  return Buffer.from(text).toString('base64url');
}

/**
 * An access token for the Sheets API, from the service account's key by
 * Google's JWT bearer grant: a claim signed with the key, exchanged for a
 * token that lasts an hour. Kept until a minute before it ends.
 */
export class GoogleAccessToken {
  private cached: { token: string; until: number } | null = null;

  constructor(
    private readonly key: ServiceAccountKey,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async get(): Promise<string> {
    if (this.cached !== null && this.cached.until > this.now()) return this.cached.token;
    const issued = Math.floor(this.now() / 1000);
    const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(
      JSON.stringify({ iss: this.key.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: issued, exp: issued + 3600 }),
    )}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(this.key.privateKey, 'base64url');
    const response = await this.fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new ReviewSheetSyncError("Google refused Atlas's service account key: check ATLAS_REVIEW_SHEET_SYNC_KEY.", {
        cause: new Error(`Google's token endpoint answered ${response.status}: ${detail}`),
      });
    }
    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.cached = { token: body.access_token, until: this.now() + (body.expires_in - 60) * 1000 };
    return body.access_token;
  }
}
