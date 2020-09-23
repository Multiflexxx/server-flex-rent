import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { OfferModule } from './offer/offer.module';

@Module({
  imports:  [UserModule, OfferModule]
})
export class AppModule {}
