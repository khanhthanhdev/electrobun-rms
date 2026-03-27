import type { SyncRepository } from "../../interfaces/sync-repository";

export interface RevokeSyncClientCommand {
  clientId: string;
}

export class RevokeSyncClientUseCase {
  constructor(private readonly syncRepository: SyncRepository) {}

  execute(command: RevokeSyncClientCommand): Promise<boolean> | boolean {
    return this.syncRepository.revokeSyncClient(command.clientId);
  }
}
