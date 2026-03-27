import type { StoredUser } from "../../dtos/users";
import type { UserRepository } from "../../interfaces/user-repository";

export class ListUsersUseCase {
  private readonly userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  execute(): Promise<StoredUser[]> {
    return this.userRepository.listUsers();
  }
}
