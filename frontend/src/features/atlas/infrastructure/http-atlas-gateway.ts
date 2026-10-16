import type {
  AtlasDictionary as AtlasDictionaryContract,
  DecodedSpecId as DecodedSpecIdContract,
  DecodeSpecIdRequest,
  EncodeSpecIdRequest,
  SavedSpecId as SavedSpecIdContract,
  SaveSpecIdRequest,
  SimilarSpecIds as SimilarSpecIdsContract,
  SpecIdExistsDetails,
} from '@contracts/atlas';
import type { ApiErrorBody, DataEnvelope } from '@contracts/envelope';
import { isAxiosError, type AxiosInstance } from 'axios';
import type { AppError } from '@/shared/application/app-error';
import { toAppError } from '@/shared/infrastructure/to-app-error';
import type { AtlasGateway } from '../application/atlas-gateway';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
import type {
  AtlasDictionary,
  DecodedSpecId,
  SavedSpecId,
  SimilarCriteria,
  SimilarSpecIds,
  SpecIdFacts,
} from '../domain/atlas';

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

  async encode(facts: SpecIdFacts): Promise<DecodedSpecId> {
    const body: EncodeSpecIdRequest = { facts };
    try {
      const response = await this.http.post<DataEnvelope<DecodedSpecIdContract>>('/atlas/spec-ids/encode', body);
      return toDecodedSpecId(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async save(input: { name: string; facts: SpecIdFacts }): Promise<SavedSpecId> {
    const body: SaveSpecIdRequest = { name: input.name, facts: input.facts };
    try {
      const response = await this.http.post<DataEnvelope<SavedSpecIdContract>>('/atlas/spec-ids', body);
      return toSavedSpecId(response.data.data);
    } catch (error) {
      throw toSaveError(error);
    }
  }

  async findByCode(code: string): Promise<SavedSpecId> {
    try {
      const response = await this.http.get<DataEnvelope<SavedSpecIdContract>>(
        `/atlas/spec-ids/${encodeURIComponent(code)}`,
      );
      return toSavedSpecId(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async findSimilar(criteria: SimilarCriteria): Promise<SimilarSpecIds> {
    try {
      const response = await this.http.get<DataEnvelope<SimilarSpecIdsContract>>('/atlas/spec-ids', {
        params: criteria,
      });
      const { fits, mightFit } = response.data.data;
      return { fits: fits.map(toSavedSpecId), mightFit: mightFit.map(toSavedSpecId) };
    } catch (error) {
      throw toAppError(error);
    }
  }
}

/** A 409 carries the Spec ID already saved: it is read before the error is flattened to an AppError. */
function toSaveError(error: unknown): AppError {
  if (isAxiosError(error) && error.response?.status === 409) {
    const body = error.response.data as Partial<ApiErrorBody> | undefined;
    const details = body?.error?.details as Partial<SpecIdExistsDetails> | undefined;
    if (body?.error?.code === 'SPEC_ID_EXISTS' && details?.existing) {
      return new SpecIdExistsError(toSavedSpecId(details.existing), body.error.message);
    }
  }
  return toAppError(error);
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

function toSavedSpecId(contract: SavedSpecIdContract): SavedSpecId {
  return {
    ...toDecodedSpecId(contract),
    name: contract.name,
    savedBy: { id: contract.savedBy.id, fullName: contract.savedBy.fullName },
    savedAt: new Date(contract.savedAt),
  };
}
