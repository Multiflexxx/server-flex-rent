import { User } from "src/user/user.model";

export interface OfferRating {
    rating_id: string,
    rating: number,
    updated_at: Date,
    rating_owner: User,
    headline?: string,
    rating_text?: string,
}