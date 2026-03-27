import { ApplicationError } from "../../common/application-error";
import type { DeleteUserAccountInput } from "../../dtos/users";
import type { UserRepository } from "../../interfaces/user-repository";

export type DeleteUserAccountCommand = DeleteUserAccountInput;

export class DeleteUserAccountUseCase {
  private readonly userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  async execute(command: DeleteUserAccountCommand): Promise<void> {
    if (command.username === command.currentUsername) {
      throw new ApplicationError(
        "You cannot delete the currently logged in user.",
        400
      );
    }

    const existingUser = await this.userRepository.getUser(command.username);
    if (!existingUser) {
      throw new ApplicationError(
        `User "${command.username}" was not found.`,
        404
      );
    }

    if (await this.userRepository.isLastGlobalAdmin(command.username)) {
      throw new ApplicationError(
        "Cannot delete the last global admin user.",
        400
      );
    }

    await this.userRepository.deleteUserAccount(command.username);
  }
}
