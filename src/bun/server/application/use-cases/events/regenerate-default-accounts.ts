import type { DefaultEventAccountsResponse } from "../../dtos/events";
import { type MaybePromise, normalizeEventsEventCode } from "./shared";

export interface DefaultAccountRegenerationService {
  regenerateDefaultAccounts(
    eventCode: string
  ): MaybePromise<DefaultEventAccountsResponse>;
}

export interface RegenerateDefaultAccountsCommand {
  eventCode: string;
}

export class RegenerateDefaultAccountsUseCase {
  constructor(
    private readonly defaultAccountRegenerationService: DefaultAccountRegenerationService
  ) {}

  async execute(
    command: RegenerateDefaultAccountsCommand
  ): Promise<DefaultEventAccountsResponse> {
    const eventCode = normalizeEventsEventCode(command.eventCode);
    const accounts =
      await this.defaultAccountRegenerationService.regenerateDefaultAccounts(
        eventCode
      );
    return accounts;
  }
}
