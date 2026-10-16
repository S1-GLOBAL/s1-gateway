import type { DataEnvelope } from '@contracts/envelope';
import type {
  Account as AccountContract,
  AccountLists as AccountListsContract,
  PasswordResetLink as PasswordResetLinkContract,
} from '@contracts/accounts';
import type { AxiosInstance } from 'axios';
import { toAppError } from '@/shared/infrastructure/to-app-error';
import type { AccountsGateway } from '../application/accounts-gateway';
import type { Account, AccountLists, PasswordResetLink } from '../domain/account';

/** The AccountsGateway port over the HTTP API. The only file in the feature that knows the wire format. */
export class HttpAccountsGateway implements AccountsGateway {
  private readonly http: AxiosInstance;

  constructor(http: AxiosInstance) {
    this.http = http;
  }

  async signUp(input: { email: string; fullName: string; password: string }): Promise<Account> {
    try {
      const response = await this.http.post<DataEnvelope<AccountContract>>('/auth/sign-up', input);
      return toAccount(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async signIn(input: { email: string; password: string }): Promise<Account> {
    try {
      const response = await this.http.post<DataEnvelope<AccountContract>>('/auth/sign-in', input);
      return toAccount(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.http.post('/auth/sign-out');
    } catch (error) {
      throw toAppError(error);
    }
  }

  async me(): Promise<Account> {
    try {
      const response = await this.http.get<DataEnvelope<AccountContract>>('/auth/me');
      return toAccount(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
    try {
      await this.http.post('/auth/change-password', input);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async resetPassword(input: { token: string; newPassword: string }): Promise<void> {
    try {
      await this.http.post('/auth/reset-password', input);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async listAccounts(): Promise<AccountLists> {
    try {
      const response = await this.http.get<DataEnvelope<AccountListsContract>>('/accounts');
      const { pending, approved, disabled } = response.data.data;
      return {
        pending: pending.map(toAccount),
        approved: approved.map(toAccount),
        disabled: disabled.map(toAccount),
      };
    } catch (error) {
      throw toAppError(error);
    }
  }

  async approveAccount(id: string): Promise<Account> {
    try {
      const response = await this.http.post<DataEnvelope<AccountContract>>(`/accounts/${id}/approve`);
      return toAccount(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async disableAccount(id: string): Promise<Account> {
    try {
      const response = await this.http.post<DataEnvelope<AccountContract>>(`/accounts/${id}/disable`);
      return toAccount(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async createPasswordResetLink(id: string): Promise<PasswordResetLink> {
    try {
      const response = await this.http.post<DataEnvelope<PasswordResetLinkContract>>(
        `/accounts/${id}/reset-password`,
      );
      const { resetUrl, expiresAt } = response.data.data;
      return { resetUrl, expiresAt: new Date(expiresAt) };
    } catch (error) {
      throw toAppError(error);
    }
  }
}

function toAccount(contract: AccountContract): Account {
  return {
    id: contract.id,
    email: contract.email,
    fullName: contract.fullName,
    status: contract.status,
    mustChangePassword: contract.mustChangePassword,
    createdAt: new Date(contract.createdAt),
    isAdmin: contract.isAdmin === true,
  };
}
