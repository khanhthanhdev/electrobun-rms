import type { BootstrappedRemoteEvent } from "../dtos/sync";

export interface SyncBootstrapService {
  bootstrapEventFromRemote(input: {
    baseUrl: string;
    eventKey: string;
  }): Promise<BootstrappedRemoteEvent>;

  createLocalEventFromBootstrap(
    result: BootstrappedRemoteEvent,
    eventCode: string
  ): Promise<{ eventCode: string }>;

  getBaseUrl(): string | null;

  setBaseUrl(baseUrl: string): string;
}
