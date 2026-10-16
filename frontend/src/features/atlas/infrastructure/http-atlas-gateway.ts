import type {
  AtlasDictionary as AtlasDictionaryContract,
  DecodedSpecId as DecodedSpecIdContract,
  DecodeSpecIdRequest,
} from '@contracts/atlas';
import type { DataEnvelope } from '@contracts/envelope';
import type { AxiosInstance } from 'axios';
import { toAppError } from '@/shared/infrastructure/to-app-error';
import type { AtlasGateway } from '../application/atlas-gateway';
import type { AtlasDictionary, DecodedSpecId } from '../domain/atlas';

/** The AtlasGateway port over the HTTP API. The only file in the feature that knows the wire format. */
export class HttpAtlasGateway implements AtlasGateway {
  private readonly http: AxiosInstance;

  constructor(http: AxiosInstance) {
    this.http = http;
  }

  async dictionary(): Promise<AtlasDictionary> {
    try {
      const response = await this.http.get<DataEnvelope<AtlasDictionaryContract>>('/atlas/dictionary');
      return toDictionary(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async decode(code: string): Promise<DecodedSpecId> {
    const body: DecodeSpecIdRequest = { code };
    try {
      const response = await this.http.post<DataEnvelope<DecodedSpecIdContract>>('/atlas/spec-ids/decode', body);
      return toDecodedSpecId(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }
}

function toDictionary(contract: AtlasDictionaryContract): AtlasDictionary {
  return {
    release: contract.release,
    approvedOn: contract.approvedOn,
    slots: contract.slots.map((slot) => ({
      key: slot.key,
      name: slot.name,
      values: slot.values.map(({ code, meaning }) => ({ code, meaning })),
    })),
    rules: contract.rules.map(({ productType, slot, rule }) => ({ productType, slot, rule })),
  };
}

function toDecodedSpecId(contract: DecodedSpecIdContract): DecodedSpecId {
  return {
    code: contract.code,
    dictionaryRelease: contract.dictionaryRelease,
    slots: contract.slots.map(({ number, key, name, raw, state, meaning }) => ({ number, key, name, raw, state, meaning })),
  };
}
