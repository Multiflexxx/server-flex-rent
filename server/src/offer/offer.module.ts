import { Module } from '@nestjs/common';
import { OfferService } from './offer.service';
import { OfferController } from './offer.controller';
import { UserModule } from 'src/user/user.module';

@Module({
    imports: [UserModule],
    providers: [OfferService],
    controllers: [OfferController]
})
export class OfferModule {}
