import { User } from "src/user/user.model";

export interface OfferRating {
    rating_id: string,
    rating: number,
    headline?: string,
    rating_text?: string,
    last_updated?: Date,
    rating_owner?: User
}