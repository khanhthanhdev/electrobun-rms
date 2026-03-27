import type { UserWithRoles } from "../../dtos/users";
import type { UserRepository } from "../../interfaces/user-repository";

export interface GetUserWithRolesQuery {
  username: string;
}

export class GetUserWithRolesUseCase {
  private readonly userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  async execute(query: GetUserWithRolesQuery): Promise<UserWithRoles | null> {
    const user = await this.userRepository.getUser(query.username);
    if (!user) {
      return null;
    }

    const roles = await this.userRepository.getUserRoles(query.username);
    return {
      ...user,
      roles,
    };
  }
}
