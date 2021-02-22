import { User } from "src/user/user.model"
import { UserRating } from "../user/user-rating.model"
import { OfferRating } from "./offer-rating.model"
import { Offer } from "./offer.model"

export interface Request {
    request_id: string,
    user?: User,
    offer?: Offer,
    status_id?: number,
    date_range?: {
        from_date?: Date,
        to_date?: Date
    },
    message?: string,
    qr_code_id?: string,
    lessor_rating?: UserRating,
    lessee_rating?: UserRating,
    offer_rating?: OfferRating,
    new_update?: boolean
}