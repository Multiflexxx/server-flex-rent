
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { CronJobs } from './util/cron/cron-jobs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Serve static file
  app.useStaticAssets(join(__dirname, '..', 'public'));
  
  await app.listen(3000);
}

bootstrap();
CronJobs.runJobs()
