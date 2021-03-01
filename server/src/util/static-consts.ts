// This file contains all const vars to avoid magic numbers in code

/* ------ GENERAL VALUES ------ */
export const CHECK_ZERO = 0;
export const FLOAT_FIXED_DECIMAL_PLACES = 2;
export const DB_RETURN_LENGTH_ONE = 1;
export const DB_TRUE = 1;
export const DB_FALSE = 0;
export const DB_DELETED_USER_PLACE_ID = -1;

/*------ OFFER ------ */
export const DEFAULT_SEARCH_DISTANCE_FOR_OFFERS = 30;
export const DEFAULT_SEARCH_LIMIT_FOR_OFFERS = 25;
export const LIMIT_FOR_OFFERS_15 = 15;
export const LIMIT_FOR_HOMEPAGE_OFFERS = 9;
export const RATING_MIN_FOR_OFFERS = 0;
export const RATING_MAX_FOR_OFFERS = 5;
export const OFFER_TITLE_MAX_LENGTH = 100;
export const MAX_NUMBER_OF_OFFER_IMAGES = 10;
export const MAX_FILE_SIZE_FOR_OFFER_IMAGES = 5242880;
export const OFFER_STATUS_DELETED = -1;
export const OFFER_STATUS_CREATED = 1;
export const OFFER_RATING_TYPE = "offer";

/* ------ CATEGORY ------ */
export const LIMIT_FOR_TOP_CATEGORIES = 4;

/* ------ REQUEST ------ */
export const REQUEST_QR_CODE_NULL = '00000000';
export const REQUEST_STATUS_OPEN = 1;
export const REQUEST_STATUS_ACCEPTED_BY_LESSOR = 2;
export const REQUEST_STATUS_REJECTED_BY_LESSOR = 3;
export const REQUEST_STATUS_ITEM_LEND_TO_LESSEE = 4;
export const REQUEST_STATUS_ITEM_RETURNED_TO_LESSOR = 5;
export const REQUEST_STATUS_REQUEST_CANCELED_BY_LESSOR = 6;
export const REQUEST_STATUS_REQUEST_CANCELED_BY_LESSEE = 7;
export const REQUEST_STATUS_REQUEST_TIMED_OUT = 8;

/* ------ USER ------ */
export const USER_RATING_DEFAULT_LIMIT = 10;
export const USER_RATING_DEFAULT_OFFSET = 0;
export const HASH_SALT_ROUNDS = 10;
export const FB_API_URL = "https://graph.facebook.com/v2.12/me?fields=name,first_name,last_name,email&access_token=";
export const RATING_TYPES: string[] = [
	"lessor",
	"lessee"
];
export const SIGN_IN_METHODS = [
	"google",
	"email",
	"facebook",
	"apple"
];
export const DEFAULT_PAGE_SIZE: number = 10;
export const userStates = {
    CREATED: 1,
    VERIFIED: 2,
    SOFT_DELETED: 3,
    HARD_DELETED: 4
}
export const userDetailLevel = {
	PUBLIC: 1,
	CONTRACT: 2,
	COMPLETE: 3
}

/* ------ RATING ------ */
export const MAX_RATING_HEADLINE_LENGTH = 400;
export const MAX_RATING_TEXT_LENGTH = 400;

/* ------ CHAT ------ */
export const MESSAGES_PER_PAGE = 20;
export const CHATS_PER_PAGE = 20;
export const MESSAGE_STATUS = {
	TEST: -1,
	SENT: 1,
	READ: 2,
}
export const MESSAGE_TYPES = {
	OFFER_REQUEST: 1,
	TEXT: 2,
	IMAGE: 3
}