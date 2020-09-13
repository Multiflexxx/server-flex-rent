import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { OfferModule } from './offer/offer.module';
import { GeoModule } from './geo/geo.module';

@Module({
  imports:  [UserModule, OfferModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
