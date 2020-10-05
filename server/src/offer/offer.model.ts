export interface Offer {
    offer_id: string,
    title: string,
    description: string,
    number_of_ratings: number,
    rating: number,
    price: number,
    category: {
        name: string,
        category_id: number,
        picture_link?: string
    },
    picture_links?: Array<string>,
    blocked_dates?: Array<{
        from_date: Date,
        to_date: Date
    }>,
    lessor?: {
        first_name: string,
        last_name: string,
        user_id: string,
        post_code: string,
        city: string,
        verified: boolean,
        lessor_rating: number,
        number_of_lessor_ratings: number
    }
}
