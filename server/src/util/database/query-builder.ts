import { User } from "src/user/user.model";
import { Query } from "./query.model";

export class QueryBuilder {

	/**
	 * Creates a user given an user object containing ALL information that will be saved to the database
	 * @param user User with data to be kept
	 */
	public static createUser(user: User): Query {
		return {
			query: "INSERT INTO user (user_id, first_name, last_name, email, phone_number, password_hash, verified, place_id, street, house_number, lessee_rating, number_of_lessee_ratings, lessor_rating, number_of_lessor_ratings, date_of_birth) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
			args: [
				user.user_id,
				user.first_name,
				user.last_name,
				user.email,
				user.phone_number,
				user.password_hash,
				user.verified,
				user.place_id,
				user.street,
				user.house_number,
				user.lessee_rating,
				user.number_of_lessee_ratings,
				user.lessor_rating,
				user.number_of_lessor_ratings,
				user.date_of_birth
			]
		}
	}

	/**
	 * Updates the following fields for a user: email, phone_number, password_hash, verified, place_id, street, house_number
	 * @param user user object containing the user_id and all fields to be updated
	 */
	public static updateUser(user: User): Query {
		return {
			query: "UPDATE user SET first_name = ?, last_name = ?, email = ?, phone_number = ?, verified = ?, place_id = ?, street = ?, house_number = ? WHERE user_id = ?;",
			args: [
				user.first_name,
				user.last_name,
				user.email,
				user.phone_number,
				user.verified,
				user.place_id,
				user.street,
				user.house_number,
				user.user_id
			]
		}
	}

	/**
	 * Looks up a user given either a user_id OR login information
	 * @param user_info object containing user information: either user_info.user_id OR user_info.login
	 */
	public static getUser(
		user_info: {
			user_id?: string,
			email?: string,
			phone?: string,
			login?: {
				email: string,
				password_hash: string
			}
		}
	): Query {
		if (user_info.user_id) {
			return {
				query: "SELECT * FROM user WHERE user_id = ?;",
				args: [
					user_info.user_id
				]
			}
		} else if (user_info.email) {
			return {
				query: "SELECT * FROM user WHERE email = ?;",
				args: [
					user_info.email
				]
			}
		} else if (user_info.phone) {
			return {
				query: "SELECT * FROM user WHERE phone_number = ?;",
				args: [
					user_info.phone
				]
			}
		} else if (user_info.login) {
			return {
				query: "SELECT * FROM user WHERE email = ? AND password_hash = ?",
				args: [
					user_info.login.email,
					user_info.login.password_hash
				]
			}
		}
	}

	/**
	 * Returns a Query to get user information for an offer by a given offer ID
	 * @param id ID of the offer which belongs to the user, which is requested
	 */
	public static getUserByOfferId(id: string): Query {
		return {
			query: "SELECT first_name, last_name,user.user_id, user.lessor_rating, user.number_of_lessor_ratings, place.post_code, place.name AS city, verified FROM user INNER JOIN offer ON offer.user_id = user.user_id INNER JOIN place ON user.place_id = place.place_id WHERE offer.offer_id = ?",
			args: [
				id
			]
		}
	}

	/**
	 * Looks up a place given a place_id or a post_code
	 * @param place_info Information of place to be looked up, either contains a place_id or a post_code
	 */
	public static getPlace(
		place_info: {
			place_id?: number,
			post_code?: string
		}
	): Query {
		if (place_info.place_id) {
			return {
				query: "SELECT * FROM place WHERE place_id = ?;",
				args: [
					place_info.place_id
				]
			}
		} else if (place_info.post_code) {
			return {
				query: "SELECT * FROM place WHERE post_code = ?;",
				args: [
					place_info.post_code
				]
			}
		}
	}

	/**
	 * Looks up an offer given an offer_id OR all offers within a limit, category or search
	 * @param offer_info object containing offer information: offer_info.offer_id OR offer_info.query
	 */
	public static getOffer(
		offer_info: {
			offer_id?: string,
			query?: {
				limit: number,
				search?: string,
				category?: number
			}
		}
	): Query {
		if (offer_info.offer_id) {
			return {
				query: "SELECT offer_id, user_id, title, description, rating, price, offer.category_id, category.name AS category_name, category.picture_link, number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id WHERE offer_id = ?;",
				args: [
					offer_info.offer_id
				]
			}
		} else if (offer_info.query) {
			if (offer_info.query.category && offer_info.query.category > 0) {
				let query = "SELECT offer_id, user_id, title, description, rating, price, offer.category_id, category.name AS category_name, category.picture_link, number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id WHERE offer.category_id = ?";
				let args = [];

				args.push(offer_info.query.category);

				if (offer_info.query.search && offer_info.query.search !== "") {
					let search = "%" + offer_info.query.search + "%";
					query += " AND title LIKE ?";
					args.push(search);
				}

				query += " LIMIT ?;";
				args.push(offer_info.query.limit);

				return {
					query: query,
					args: args
				}
			} else if (offer_info.query.search && offer_info.query.search !== "") {
				let query = "SELECT offer_id, user_id, title, description, rating, price, offer.category_id, category.name AS category_name, category.picture_link, number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id WHERE title LIKE ?";
				let args = [];

				let search = "%" + offer_info.query.search + "%";
				args.push(search);

				if (offer_info.query.category && offer_info.query.category > 0) {
					query += " AND category_id = ?";
					args.push(offer_info.query.category);
				}

				query += " LIMIT ?;";
				args.push(offer_info.query.limit);

				return {
					query: query,
					args: args
				}
			} else {
				return {
					query: "SELECT offer_id, user_id, title, description, rating, price, offer.category_id, category.name AS category_name, category.picture_link, number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id LIMIT ?;",
					args: [
						offer_info.query.limit
					]
				}
			}
		} else {
			return {
				query: "SELECT offer_id, user_id, title, description, rating, price, offer.category_id, category.name AS category_name, category.picture_link, number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id FROM offer LIMIT 15;",
				args: []
			}
		}
	}

	/**
	 * Returns all categories OR a category with a given id
	 * @param category_info 
	 */
	public static getCategories(category_info: {
		category_id?: number
	}): Query {
		if(category_info.category_id) {
			return {
				query: "SELECT * FROM category WHERE category_id = ?;",
				args: [
					category_info.category_id
				]
			}
		} else {
			return {
				query: "SELECT * FROM category;",
				args: []
			}
		}
		
	}

	/**
	 * Returns all blocked dates for a given offer_id
	 * @param id ID of the offer for which the blocked dates are requested
	 */
	public static getBlockedOfferDates(id: string): Query {
		return {
			query: "SELECT * FROM offer_blocked WHERE offer_id = ? AND (from_date >= NOW() OR to_date >= NOW());",
			args: [
				id
			]
		}
	}

	/**
	 * Returns all picture details for a given offer_id
	 * @param id ID of the offer for which the picture data is requested
	 */
	public static getOfferPictures(id: string): Query {
		return {
			query: "SELECT * FROM offer_picture WHERE offer_id = ?;",
			args: [
				id
			]
		}
	}

	/**
	 * Returns a Query to create a new offer with the given values
	 * @param offer Offer object containing the data to create a new offer
	 */
	public static createOffer(offer: {
		offer_id: string,
		user_id: string,
		title: string,
		description: string,
		rating: number,
		number_of_ratings: number,
		price: number,
		category_id: number
	}) : Query {
		return {
			query: "INSERT INTO offer (offer_id, user_id, title, description, rating, price, category_id, number_of_ratings) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
			args: [
				offer.offer_id,
				offer.user_id,
				offer.title,
				offer.description,
				offer.rating,
				offer.price,
				offer.category_id,
				offer.number_of_ratings
			]
		}
		return null
	}

	/**
	 * Returns a Query to update a given offer
	 * @param offer Data which are needed to update the offer object
	 */
	public static updateOffer(offer: {
		offer_id: string,
		title: string,
		description: string,
		price: number,
		category_id: number
	}): Query {
		return {
			query: "UPDATE offer SET title = ?, description = ?, price = ?, category_id = ? WHERE offer_id = ?;",
			args: [
				offer.title,
				offer.description,
				offer.price,
				offer.category_id,
				offer.offer_id
			]
		}
	}

	/**
	 * Returns a Query to delete an offer with a given ID
	 * @param id ID of the offer to be deleted
	 */
	public static deleteOfferById(id: string): Query {
		return {
			query: "DELETE FROM offer WHERE offer_id = ?;",
			args: [
				id
			]
		}
	}

	/**
	 * Returns a Query to delete all blocked dates to a given offer id
	 * @param id ID of the offer for which the blocked dates shall be deleted
	 */
	public static deleteBlockedDatesForOfferId(id: string): Query {
		return {
			query: "DELETE FROM offer_blocked WHERE offer_id = ?;",
			args: [
				id
			]
		}
	}

	/**
	 * Returns a query to delete all picture uuid's for a given offer ID
	 * @param id ID of the offer
	 */
	public static deletePicturesByOfferId(id: string): Query {
		return {
			query: "DELETE FROM offer_picture WHERE offer_id = ?;",
			args: [
				id
			]
		}
	}

	public static deletePictureById(id: string): Query {
		return {
			query: "DELETE FROM offer_picture WHERE uuid = ?;",
			args: [
				id
			]
		}
	}

	/**
	 * Returns a Query to insert either a blocked date range with reason
	 * or a blocked date range without a reason
	 * @param blocked_date Data which is needed to insert a new blocked date range
	 */
	public static insertBlockedDateForOfferId(blocked_date: {
		offer_blocked_id: string,
		offer_id: string,
		from_date: Date,
		to_date: Date,
		reason?: string
	}): Query {
		if(blocked_date.reason !== undefined
			&& blocked_date.reason !== null
			&& blocked_date.reason !== "") {
				return {
					query: "INSERT INTO offer_blocked (offer_blocked_id, offer_id, from_date, to_date, reason) VALUES (?, ?, ?, ?, ?)",
					args: [
						blocked_date.offer_blocked_id,
						blocked_date.offer_id,
						blocked_date.from_date,
						blocked_date.to_date,
						blocked_date.reason
					]
				}
			} else {
				return {
					query: "INSERT INTO offer_blocked (offer_blocked_id, offer_id, from_date, to_date) VALUES (?, ?, ?, ?)",
					args: [
						blocked_date.offer_blocked_id,
						blocked_date.offer_id,
						blocked_date.from_date,
						blocked_date.to_date
					]
				}
			}
	}

	/**
	 * Creates a Session for a user given a session_id (uuid4) and a user_id
	 * @param session_id Session ID of new session
	 * @param user_id User ID of user
	 */
	public static createSession(session_id: string, user_id: string): Query {
		return {
			query: "INSERT INTO user_session (session_id, user_id, stay_logged_in, expiration_date) VALUES (?, ?, true, DATE_ADD(CURRENT_DATE(), INTERVAL 1 YEAR));",
			args: [
				session_id,
				user_id
			]
		}
	}

	/**
	 * Get session by session_id
	 * @param session_id 
	 */
	public static getSession(session_id: string): Query {
		return {
			query: "SELECT * FROM user_session WHERE session_id = ?;",
			args: [
				session_id
			]
		}
	}

	/**
	 * Deletes all old active sessions for a user
	 * @param user_id 
	 */
	public static deleteOldSessions(user_id: string): Query {
		return {
			query: "DELETE FROM user_session WHERE user_id = ?;",
			args: [
				user_id
			]
		}
	}

	
	/** 
	 * Returns a Query to insert an image ID and offer ID  in the pictures table
	 * @param offer_id ID of the offer
	 * @param image_id ID of the image
	 */
	public static insertImageByOfferId(offer_id:string, image_id: string): Query {
		return {
			query: "INSERT INTO offer_picture (offer_id, uuid) VALUES (?, ?);",
			args: [
				offer_id,
				image_id
			]
		}
	}

	public static testQuery() {
		return {
			query: "SELECT * FROM place WHERE place_id < 4;",
				args: [
				]
		}
	}
}