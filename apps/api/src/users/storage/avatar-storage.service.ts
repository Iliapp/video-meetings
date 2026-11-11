import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { avatarsConfig, type AvatarsConfig } from '../avatars.config';

// Hides the file layout from the rest of the code:
//   AVATARS_DIR/incoming/<uuid>  being uploaded or awaiting validation
//   AVATARS_DIR/<uuid>           a saved avatar, referenced by User.avatarKey
// Every commit gets a new key, so the key can double as the avatar's URL and
// changes with every upload.
@Injectable()
export class AvatarStorageService implements OnModuleInit {
  readonly incomingDir: string;

  constructor(
    @Inject(avatarsConfig.KEY) private readonly config: AvatarsConfig,
  ) {
    this.incomingDir = join(config.dir, 'incoming');
  }

  // Creates the directories and drops uploads cut off by a crash or restart.
  // Assumes one api instance per AVATARS_DIR.
  async onModuleInit(): Promise<void> {
    await mkdir(this.incomingDir, { recursive: true });
    const leftovers = await readdir(this.incomingDir);
    await Promise.all(
      leftovers.map((name) =>
        rm(join(this.incomingDir, name), { recursive: true, force: true }),
      ),
    );
  }

  // Moves a validated upload into place and returns its storage key. Both
  // paths are under AVATARS_DIR, so the rename is atomic.
  async commit(tempPath: string): Promise<string> {
    const key = randomUUID();
    await rename(tempPath, this.pathFor(key));
    return key;
  }

  // Only UUID keys are accepted, so a key can never point outside the directory.
  pathFor(key: string): string {
    if (!isUUID(key)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return join(this.config.dir, key);
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  // Deletes an upload that was rejected before it was committed.
  async discard(tempPath: string): Promise<void> {
    await rm(tempPath, { force: true });
  }
}
