import type {
  AtlasDictionary as AtlasDictionaryContract,
  DecodedSpecId as DecodedSpecIdContract,
  DecodeSpecIdRequest,
  EncodeSpecIdRequest,
  SavedSpecId as SavedSpecIdContract,
  SaveSpecIdRequest,
  SimilarSpecIds as SimilarSpecIdsContract,
  SpecIdChange as SpecIdChangeContract,
  SpecIdExistsDetails,
  SpecIdLookup as SpecIdLookupContract,
  UpdateSpecIdRequest,
} from '@contracts/atlas';
import type { ApiErrorBody, DataEnvelope } from '@contracts/envelope';
import { isAxiosError, type AxiosInstance } from 'axios';
import type { AppError } from '@/shared/application/app-error';
import { toAppError } from '@/shared/infrastructure/to-app-error';
import type { AtlasGateway } from '../application/atlas-gateway';
import { SpecIdChangedError } from '../application/spec-id-changed-error';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
import type {
  AtlasDictionary,
  DecodedSpecId,
  SavedSpecId,
  SimilarCriteria,
  SimilarSpecIds,
  SpecIdChange,
  SpecIdFacts,
  SpecIdLookup,
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

  async findByCode(code: string): Promise<SpecIdLookup> {
    try {
      const response = await this.http.get<DataEnvelope<SpecIdLookupContract>>(
        `/atlas/spec-ids/${encodeURIComponent(code)}`,
      );
      return toSpecIdLookup(response.data.data);
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

  async getSaved(id: string): Promise<SavedSpecId> {
    try {
      const response = await this.http.get<DataEnvelope<SavedSpecIdContract>>(`/atlas/saved/${encodeURIComponent(id)}`);
      return toSavedSpecId(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async update(id: string, input: { name: string; facts: SpecIdFacts; version: number }): Promise<SavedSpecId> {
    const body: UpdateSpecIdRequest = { name: input.name, facts: input.facts, version: input.version };
    try {
      const response = await this.http.patch<DataEnvelope<SavedSpecIdContract>>(
        `/atlas/saved/${encodeURIComponent(id)}`,
        body,
      );
      return toSavedSpecId(response.data.data);
    } catch (error) {
      throw toSaveError(error);
    }
  }

  async history(id: string): Promise<SpecIdChange[]> {
    try {
      const response = await this.http.get<DataEnvelope<SpecIdChangeContract[]>>(
        `/atlas/saved/${encodeURIComponent(id)}/history`,
      );
      return response.data.data.map(toSpecIdChange);
    } catch (error) {
      throw toAppError(error);
    }
  }
}

/**
 * A 409 says which conflict it is: the Spec ID already saved under the code,
 * read before the error is flattened to an AppError, or a change someone saved
 * first.
 */
function toSaveError(error: unknown): AppError {
  if (isAxiosError(error) && error.response?.status === 409) {
    const body = error.response.data as Partial<ApiErrorBody> | undefined;
    const details = body?.error?.details as Partial<SpecIdExistsDetails> | undefined;
    if (body?.error?.code === 'SPEC_ID_EXISTS' && details?.existing) {
      return new SpecIdExistsError(toSavedSpecId(details.existing), body.error.message);
    }
    if (body?.error?.code === 'SPEC_ID_CHANGED') return new SpecIdChangedError(body.error.message);
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
    id: contract.id,
    name: contract.name,
    savedBy: { id: contract.savedBy.id, fullName: contract.savedBy.fullName },
    savedAt: new Date(contract.savedAt),
    version: contract.version,
    updatedBy: contract.updatedBy ? { id: contract.updatedBy.id, fullName: contract.updatedBy.fullName } : null,
    updatedAt: contract.updatedAt ? new Date(contract.updatedAt) : null,
  };
}

function toSpecIdLookup(contract: SpecIdLookupContract): SpecIdLookup {
  return {
    ...toSavedSpecId(contract),
    replacedCode: contract.replacedCode,
    formerHolders: contract.formerHolders.map(({ id, name, code, until }) => ({ id, name, code, until: new Date(until) })),
  };
}

function toSpecIdChange(contract: SpecIdChangeContract): SpecIdChange {
  return {
    kind: contract.kind,
    changedBy: { id: contract.changedBy.id, fullName: contract.changedBy.fullName },
    changedAt: new Date(contract.changedAt),
    codeBefore: contract.codeBefore,
    codeAfter: contract.codeAfter,
    nameBefore: contract.nameBefore,
    nameAfter: contract.nameAfter,
    slots: contract.slots.map(({ key, name, before, after, corrected }) => ({ key, name, before, after, corrected })),
  };
}
