import { ApplicationError } from "../../common/application-error";
import type {
  ManagedUserAccount,
  UpdateUserAccountInput,
} from "../../dtos/users";
import type { UserRepository } from "../../interfaces/user-repository";
import {
  buildManagedUserAccount,
  hashUserPassword,
  validateUserRoleAssignments,
} from "./shared";

export type UpdateUserAccountCommand = UpdateUserAccountInput;

export class UpdateUserAccountUseCase {
  private readonly userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  async execute(
    command: UpdateUserAccountCommand
  ): Promise<ManagedUserAccount> {
    const roles = await validateUserRoleAssignments(
      this.userRepository,
      command.roles
    );
    const existingUser = await this.userRepository.getUser(command.username);
    if (!existingUser) {
      throw new ApplicationError(
        `User "${command.username}" was not found.`,
        404
      );
    }

    const hashedPassword =
      command.password.length > 0
        ? await hashUserPassword(command.password)
        : null;

    await this.userRepository.updateUserAccount({
      username: command.username,
      hashedPassword,
      roles,
    });

    return buildManagedUserAccount(command.username, roles);
  }
}
