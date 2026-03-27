import type { SyncClientAuthentication } from "../../dtos/sync";
import type { SyncRepository } from "../../interfaces/sync-repository";

export interface AuthenticateSyncClientQuery {
  bearerToken: string;
}

export class AuthenticateSyncClientUseCase {
  constructor(private readonly syncRepository: SyncRepository) {}

  execute(
    query: AuthenticateSyncClientQuery
  ): Promise<SyncClientAuthentication> | SyncClientAuthentication {
    return this.syncRepository.authenticateClient(query.bearerToken);
  }
}
