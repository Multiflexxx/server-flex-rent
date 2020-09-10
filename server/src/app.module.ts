import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { OfferModule } from './offer/offer.module';
import { GeoController } from './geo/geo.controller';
import { GeoService } from './geo/geo.service';

@Module({
  imports:  [AuthModule, UserModule, OfferModule],
  controllers: [AppController, GeoController],
  providers: [AppService, GeoService],
})
export class AppModule {}
