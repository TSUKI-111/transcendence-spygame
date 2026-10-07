import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('db-test')
  getDbStatus() {
    return this.appService.getDbStatus();
  }
  @Get('ready')
  getReadiness() {
    return this.appService.getReadiness();
  }
}
