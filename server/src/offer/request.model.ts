import { User } from "src/user/user.model"
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
    qr_code_id?: string
}