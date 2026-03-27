import type { SyncBootstrapService } from "../../interfaces/sync-bootstrap-service";

export class GetSyncRemoteBaseUrlUseCase {
  constructor(private readonly syncBootstrapService: SyncBootstrapService) {}

  execute(): string | null {
    return this.syncBootstrapService.getBaseUrl();
  }
}
