import type { SyncBootstrapService } from "../../interfaces/sync-bootstrap-service";

export interface SetSyncRemoteBaseUrlCommand {
  baseUrl: string;
}

export class SetSyncRemoteBaseUrlUseCase {
  constructor(private readonly syncBootstrapService: SyncBootstrapService) {}

  execute(command: SetSyncRemoteBaseUrlCommand): string {
    return this.syncBootstrapService.setBaseUrl(command.baseUrl);
  }
}
