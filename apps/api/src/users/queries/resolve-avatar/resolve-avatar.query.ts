import { Query } from '@nestjs/cqrs';

// What GET /avatars/:key needs to send the file.
export interface AvatarFile {
  path: string;
  mimeType: string;
}

// No Bearer token: the URL is opened by <img src>. Only a key some user
// currently has resolves; anything else is 404 Avatar not found.
export class ResolveAvatarQuery extends Query<AvatarFile> {
  constructor(readonly key: string) {
    super();
  }
}
