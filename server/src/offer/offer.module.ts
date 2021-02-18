import { forwardRef, Module } from '@nestjs/common';
import { OfferService } from './offer.service';
import { OfferController } from './offer.controller';
import { UserModule } from 'src/user/user.module';

@Module({
    imports: [forwardRef(() => UserModule)],
    providers: [OfferService],
    controllers: [OfferController],
    exports: [OfferService]
})
export class OfferModule {}
