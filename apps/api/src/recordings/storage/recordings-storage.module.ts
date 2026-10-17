import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { recordingsConfig } from '../recordings.config';
import { RecordingsStorageService } from './recordings-storage.service';

// A module of its own so MulterModule.registerAsync can import the storage
// (for the incoming directory) and the recordings config (for the size limit).
@Module({
  imports: [ConfigModule.forFeature(recordingsConfig)],
  providers: [RecordingsStorageService],
  exports: [ConfigModule, RecordingsStorageService],
})
export class RecordingsStorageModule {}
