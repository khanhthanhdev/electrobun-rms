import type { SyncBootstrapService } from "../../interfaces/sync-bootstrap-service";

export interface BootstrapEventFromRemoteCommand {
  baseUrl: string;
  eventCode: string;
  eventKey: string;
}

export class BootstrapEventFromRemoteUseCase {
  constructor(private readonly syncBootstrapService: SyncBootstrapService) {}

  async execute(
    command: BootstrapEventFromRemoteCommand
  ): Promise<{ eventCode: string }> {
    const result = await this.syncBootstrapService.bootstrapEventFromRemote({
      baseUrl: command.baseUrl,
      eventKey: command.eventKey,
    });

    return this.syncBootstrapService.createLocalEventFromBootstrap(
      result,
      command.eventCode
    );
  }
}
