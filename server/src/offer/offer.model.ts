export interface Offer {
    offer_id: string,
    title: string,
    description: string,
    number_of_ratings: number,
    rating: number,
    category_id: number,
    user_id: string,
    price: number,
    picture_links?: Array<string>,
    blocked_dates?: Array<{
        from_date: Date,
        to_date: Date
    }>
}