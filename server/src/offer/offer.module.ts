import { Module } from '@nestjs/common';
import { OfferService } from './offer.service';
import { OfferController } from './offer.controller';

@Module({
    providers: [OfferService],
    controllers: [OfferController]
})
export class OfferModule {}
