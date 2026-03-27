import type {
  CreateUserAccountInput,
  ManagedUserAccount,
} from "../../dtos/users";
import type { UserRepository } from "../../interfaces/user-repository";
import {
  buildManagedUserAccount,
  hashUserPassword,
  validateUserRoleAssignments,
} from "./shared";

export type CreateUserAccountCommand = CreateUserAccountInput;

export class CreateUserAccountUseCase {
  private readonly userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  async execute(
    command: CreateUserAccountCommand
  ): Promise<ManagedUserAccount> {
    const roles = await validateUserRoleAssignments(
      this.userRepository,
      command.roles
    );
    const hashedPassword = await hashUserPassword(command.password);

    await this.userRepository.createUserAccount({
      username: command.username,
      hashedPassword,
      roles,
    });

    return buildManagedUserAccount(command.username, roles);
  }
}
