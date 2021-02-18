import { forwardRef, Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { OfferModule } from 'src/offer/offer.module';


@Module({
    imports: [forwardRef(() => OfferModule)],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
})
export class UserModule {}
