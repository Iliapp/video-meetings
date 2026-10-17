import { Module } from '@nestjs/common';
import { RecordingsStorageModule } from './storage/recordings-storage.module';

@Module({
  imports: [RecordingsStorageModule],
})
export class RecordingsModule {}
