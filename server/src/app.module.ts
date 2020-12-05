import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { OfferModule } from './offer/offer.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [UserModule, OfferModule, ChatModule],
})
export class AppModule {}
