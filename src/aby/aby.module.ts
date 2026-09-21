import { Module } from '@nestjs/common';
import { AbyController } from './aby.controller';
import { AbyService } from './aby.service';
import { PersonaService } from './persona.service';
import { OpencodeService } from './opencode.service';

@Module({
  controllers: [AbyController],
  providers: [AbyService, PersonaService, OpencodeService],
  exports: [AbyService, PersonaService, OpencodeService],
})
export class AbyModule {}
