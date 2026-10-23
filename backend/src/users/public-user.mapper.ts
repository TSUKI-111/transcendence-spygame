import type { PublicUser } from './public-user.type.js';

type PublicUserSource = {
  id: number;
  username: string;
  displayName: string;
};

export function toPublicUser(user: PublicUserSource): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: null,
  };
}