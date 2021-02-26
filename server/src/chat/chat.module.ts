import { forwardRef, Module } from '@nestjs/common';
import { OfferModule } from 'src/offer/offer.module';
import { UserModule } from 'src/user/user.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [UserModule, OfferModule],
  controllers: [ChatController],
  providers: [ChatService]
})
export class ChatModule {}
