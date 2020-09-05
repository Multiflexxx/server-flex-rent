import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class OfferService {
    getHomePageOffers() {
        throw new Error("Method not implemented.");
    }

    getAll(query: {}) {
        throw new Error("Method not implemented.");
    }

    getOfferById(id: number) {
        return new NotFoundException("Offer not found");
    }

    createOffer(reqBody: {}) {
        throw new Error("Method not implemented.");
    }

    updateOffer(id: any, reqbody: any) {
        throw new Error("Method not implemented.");
    }

    deleteOffer(id: any, reqBody: any) {
        throw new Error("Method not implemented.");
    }
    
}
