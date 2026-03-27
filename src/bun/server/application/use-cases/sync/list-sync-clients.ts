import type { SyncClientItem } from "../../dtos/sync";
import type { SyncRepository } from "../../interfaces/sync-repository";

export interface ListSyncClientsQuery {
  eventCode: string;
}

export class ListSyncClientsUseCase {
  constructor(private readonly syncRepository: SyncRepository) {}

  execute(
    query: ListSyncClientsQuery
  ): Promise<SyncClientItem[]> | SyncClientItem[] {
    return this.syncRepository.listSyncClients(query.eventCode);
  }
}
