import { Module } from '@nestjs/common';
import { OperatorsController } from './operators.controller.js';

// AuthModule is @Global, so AuthService needs no import here.
@Module({
  controllers: [OperatorsController],
})
export class OperatorsModule {}
