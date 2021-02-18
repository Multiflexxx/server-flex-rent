import { User } from "./user.model";

export interface UserRating {
    rating_id: string,
    rating_type: string,
    rating: number,
    headline: string,
    rating_text: string,
    rated_user: User,
    rating_user: User,
    updated_at: Date
}