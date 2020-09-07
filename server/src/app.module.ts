import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OfferController } from './offer/offer.controller';
import { OfferService } from './offer/offer.service';
import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { OfferModule } from './offer/offer.module';

@Module({
  imports:  [AuthModule, UserModule, OfferModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
