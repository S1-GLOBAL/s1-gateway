import type { AtlasDictionary, DecodedSpecId } from '../domain/atlas';

/**
 * Where the Atlas feature reads the dictionary and decodes Spec IDs. The
 * application owns this port; infrastructure implements it over HTTP. Every
 * method rejects with an AppError.
 */
export interface AtlasGateway {
  dictionary(): Promise<AtlasDictionary>;
  decode(code: string): Promise<DecodedSpecId>;
}
