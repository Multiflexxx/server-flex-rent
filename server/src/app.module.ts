import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HelloWorldModule } from './hello-world/hello-world.module';
import { OfferController } from './offer/offer.controller';
import { OfferService } from './offer/offer.service';
import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';

@Module({
  imports: [HelloWorldModule],
  controllers: [AppController, OfferController, UserController],
  providers: [AppService, OfferService, UserService],
})
export class AppModule {}
