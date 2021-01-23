import { User } from "src/user/user.model";
import { Query } from "./query.model";
import { Request } from "src/offer/request.model";
const moment = require('moment');
import { request } from "express";
import { UserService } from "src/user/user.service";

export class QueryBuilder {
	/**
	 * Creates a user given an user object containing ALL information that will be saved to the database
	 * @param user User with data to be kept
	 */
	public static createUser(user: User, method: string): Query {
		return {
			query: "INSERT INTO user (user_id, first_name, last_name, email, phone_number, password_hash, verified, place_id, street, house_number, lessee_rating, number_of_lessee_ratings, lessor_rating, number_of_lessor_ratings, date_of_birth, sign_in_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
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
				user.date_of_birth,
				method
			]
		}
	}

	/**
	 * Updates the following fields for a user: email, phone_number, password_hash, verified, place_id, street, house_number
	 * @param user user object containing the user_id and all fields to be updated
	 */
	public static updateUser(user: User, new_password: string): Query {
		let query: string = "UPDATE user SET first_name = ?, last_name = ?, email = ?, phone_number = ?, verified = ?, street = ?, house_number = ?, place_id = ?";

		let args: any[] = [
			user.first_name,
			user.last_name,
			user.email,
			user.phone_number,
			user.verified,
			user.street,
			user.house_number,
			user.place_id
		];

		if (new_password) {
			query += ", password_hash = ?";
			args.push(new_password);
		}

		query += " WHERE user_id = ?;";
		args.push(user.user_id);

		return {
			query: query,
			args: args
		}
	}

	public static changeProfilePicture(user_id: string, url: string): Query {
		return {
			query: "UPDATE user SET profile_picture = ? WHERE user_id = ?;",
			args: [
				url,
				user_id
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
			},
			oauth?: {
				email: string,
				method: string
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
				query: "SELECT * FROM user WHERE email = ? AND password_hash = ?;",
				args: [
					user_info.login.email,
					user_info.login.password_hash
				]
			}
		} else if (user_info.oauth) {
			return {
				query: "SELECT * FROM user WHERE email = ? AND sign_in_method = ?;",
				args: [
					user_info.oauth.email,
					user_info.oauth.method
				]
			}
		}
	}


	/**
	 * Sets a user's status to soft_deleted or hard_deleted. 
	 * @param user_id 
	 * @param deletion_date Optional parameter, if deletion date differs from default (7 days)
	 */
	public static softDeleteUser(user_id: string, deletion_date?) {
		return {
			query: "UPDATE user SET status_id = ?, deletion_date = ? WHERE user_id = ?;",
			args: [
				UserService.userStates.softDeleted,
				!deletion_date ? moment().add(7, 'days').format('YYYY-MM-DD'): deletion_date,
				user_id
			]
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
	 * Looks up an offer given an offer_id OR all offers within a limit, category or search OR all offers for a user
	 * @param offer_info object containing offer information: offer_info.offer_id OR offer_info.query
	 * place_ids is a prebuild string to filter for the offer locations in a given distance
	 */
	public static getOffer(
		offer_info: {
			offer_id?: string,
			query?: {
				place_ids: string,
				distance: number
				limit: number,
				search?: string,
				category?: number,
			},
			user_id?: string
		}
	): Query {
		if (offer_info.offer_id) {
			return {
				query: "SELECT offer_id, user_id, title, description, rating, price, offer.category_id, category.name AS category_name, category.picture_link, number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id WHERE offer_id = ? AND offer_status != -1;",
				args: [
					offer_info.offer_id
				]
			}
		} else if (offer_info.query) {
			if (offer_info.query.category && offer_info.query.category > 0) {
				let query = `SELECT offer_id, offer.user_id, title, description, rating, price, offer.category_id, category.name AS category_name, category.picture_link, number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id JOIN user ON offer.user_id = user.user_id WHERE ${offer_info.query.place_ids} AND offer.category_id = ? `;
				let args = [];

				args.push(offer_info.query.category);

				if (offer_info.query.search && offer_info.query.search !== "") {
					let search = "%" + offer_info.query.search + "%";
					query += " AND title LIKE ? AND offer_status != -1 ";
					args.push(search);
				}

				query += " LIMIT ?;";
				args.push(offer_info.query.limit);

				return {
					query: query,
					args: args
				}
			} else if (offer_info.query.search && offer_info.query.search !== "") {
				let query = `SELECT offer_id, offer.user_id, title, description, rating, price, offer.category_id, category.name AS category_name, category.picture_link, number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id JOIN user ON offer.user_id = user.user_id WHERE ${offer_info.query.place_ids} AND title LIKE ? `;
				let args = [];

				let search = "%" + offer_info.query.search + "%";
				args.push(search);

				if (offer_info.query.category && offer_info.query.category > 0) {
					query += " AND category_id = ? AND offer_status != -1 ";
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
					query: `SELECT offer_id, offer.user_id, title, description, rating, price, offer.category_id, category.name AS category_name, category.picture_link, number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id JOIN user ON offer.user_id = user.user_id WHERE ${offer_info.query.place_ids} AND offer_status != -1 LIMIT ?;`,
					args: [
						offer_info.query.limit
					]
				}
			}
		} else if (offer_info.user_id) {
			return {
				query: "SELECT offer_id, user_id, title, description, rating, price, offer.category_id, category.name AS category_name, category.picture_link, number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id WHERE user_id = ? AND offer_status != -1;",
				args: [
					offer_info.user_id
				]
			}
		} else {
			return {
				query: "SELECT offer_id, user_id, title, description, rating, price, offer.category_id, category.name AS category_name, category.picture_link, number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id AND offer_status != -1 LIMIT 15;",
				args: []
			}
		}
	}

	/**
	 * Returns a list of locations where the distance is in range from a given location
	 * @param location_info 
	 */
	public static getLocationIdsByDistance(location_info: {
		place_id_1: number,
		distance: number
	}): Query {
		return {
			query: "SELECT place_id_2 FROM distance_matrix WHERE place_id_1 = ? AND distance <= ?",
			args: [
				location_info.place_id_1,
				location_info.distance
			]
		}
	}
	/**
	 * Returns a Query to get either nine of the best offers by offer rating, by lessor rating or the latest offers
	 * @param offer_info different params to get different queries
	 * place_ids is a prebuild string to filter for the offer locations in a given distance
	 */
	public static getHomepageOffers(offer_info: {
		best_offers?: boolean,
		latest_offers?: boolean,
		best_lessors?: boolean,
		place_ids: string
	}): Query {
		if (offer_info) {
			if (offer_info && offer_info.best_offers) {
				return {
					query: `SELECT offer_id, offer.user_id, title, description, offer.rating, price, offer.category_id, category.name AS category_name, category.picture_link, offer.number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id JOIN user ON offer.user_id = user.user_id WHERE ${offer_info.place_ids} AND offer_status != -1 ORDER BY offer.rating DESC, offer.number_of_ratings DESC LIMIT 9;`,
					args: []
				}
			} else if (offer_info && offer_info.latest_offers) {
				return {
					query: `SELECT offer_id, offer.user_id, title, description, offer.rating, price, offer.category_id, category.name AS category_name, category.picture_link, offer.number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id JOIN user ON offer.user_id = user.user_id WHERE ${offer_info.place_ids} AND offer_status != -1 ORDER BY offer.created_at DESC LIMIT 9;`,
					args: []
				}
			} else if (offer_info && offer_info.best_lessors) {
				return {
					query: `SELECT offer_id, offer.user_id, title, description, offer.rating, price, offer.category_id, category.name AS category_name, category.picture_link, offer.number_of_ratings FROM offer JOIN category ON offer.category_id = category.category_id JOIN user ON offer.user_id = user.user_id WHERE ${offer_info.place_ids} AND offer_status != -1 ORDER BY user.lessor_rating DESC, user.number_of_lessor_ratings DESC LIMIT 9;`,
					args: []
				}
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
		if (category_info.category_id) {
			return {
				query: "SELECT * FROM category WHERE category_id = ? ORDER BY name ASC;",
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
		category_id: number,
	}): Query {
		return {
			query: "INSERT INTO offer (offer_id, user_id, title, description, rating, price, category_id, number_of_ratings, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW());",
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
			query: "UPDATE offer SET title = ?, description = ?, price = ?, category_id = ? WHERE offer_id = ? AND offer_status != -1;",
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
	 * Returns a Query to update the offer rating
	 * @param rating Information needed to update rating for offer
	 */
	public static updateOfferRating(rating: {
		offer_id: string,
		rating: number,
		number_of_ratings: number
	}): Query {
		return {
			query: "UPDATE offer SET rating = ?, number_of_ratings = ? WHERE offer_id = ? AND offer_status != -1;",
			args: [
				rating.rating,
				rating.number_of_ratings,
				rating.offer_id
			]
		}
	}

	// /**
	//  * Returns a Query to delete an offer with a given ID
	//  * @param id ID of the offer to be deleted
	//  */
	// public static deleteOfferById(id: string): Query {
	// 	return {
	// 		query: "DELETE FROM offer WHERE offer_id = ?;",
	// 		args: [
	// 			id
	// 		]
	// 	}
	// }

	public static softDeleteOfferById(id: string): Query {
		return {
			query: "UPDATE offer SET title = CONCAT('(Gelöscht) ', title), description = '(Angebot wurde gelöscht.)', deletion_date = NOW(), status_id = -1 WHERE offer_id = ?;",
			args: [
				id
			]
		}
	}

	/**
	 * Returns a Query to delete all blocked dates to a given offer id
	 * @param id ID of the offer for which the blocked dates shall be deleted
	 */
	public static deleteBlockedDatesForOfferId(id: string, is_lessor: boolean): Query {
		return {
			query: "DELETE FROM offer_blocked WHERE offer_id = ? AND is_lessor = ?;",
			args: [
				id,
				is_lessor
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

	/**
	 * Returns a query to delete a picture by a given id
	 * @param id ID of the picture to be deleted
	 */
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
		is_lessor: boolean,
		reason?: string
	}): Query {
		if (blocked_date.reason !== undefined
			&& blocked_date.reason !== null
			&& blocked_date.reason !== "") {
			return {
				query: "INSERT INTO offer_blocked (offer_blocked_id, offer_id, from_date, to_date, is_lessor, reason) VALUES (?, ?, ?, ?, ?, ?)",
				args: [
					blocked_date.offer_blocked_id,
					blocked_date.offer_id,
					blocked_date.from_date,
					blocked_date.to_date,
					blocked_date.is_lessor,
					blocked_date.reason
				]
			}
		} else {
			return {
				query: "INSERT INTO offer_blocked (offer_blocked_id, offer_id, from_date, to_date, is_lessor) VALUES (?, ?, ?, ?, ?)",
				args: [
					blocked_date.offer_blocked_id,
					blocked_date.offer_id,
					blocked_date.from_date,
					blocked_date.to_date,
					blocked_date.is_lessor
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
	public static insertImageByOfferId(offer_id: string, image_id: string): Query {
		return {
			query: "INSERT INTO offer_picture (offer_id, uuid) VALUES (?, ?);",
			args: [
				offer_id,
				image_id
			]
		}
	}

	/**
	 * Returns a query to create a request on database
	 * @param request Data to fill the request table
	 */
	public static createRequest(request: Request): Query {
		return {
			query: "INSERT INTO request (request_id, user_id, offer_id, status_id, from_date, to_date, message, qr_code_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
			args: [
				request.request_id,
				request.user.user_id,
				request.offer.offer_id,
				request.status_id,
				request.date_range.from_date,
				request.date_range.to_date,
				request.message,
				request.qr_code_id
			]
		}
	}

	/**
	 * Returns a query to update the request on database
	 * @param request Request-object which is needed to update database
	 */
	public static updateRequest(request: Request): Query {
		if (request.qr_code_id) {
			return {
				query: "UPDATE request SET status_id = ?, qr_code_id = ? WHERE request_id = ?;",
				args: [
					request.status_id,
					request.qr_code_id,
					request.request_id
				]
			}
		} else {
			return {
				query: "UPDATE request SET status_id = ? WHERE request_id = ?;",
				args: [
					request.status_id,
					request.request_id
				]
			}
		}

	}

	/**
	 * Returns a Query to get all requests for a given user_id OR a specific request by it's ID
	 * @param request_info ID of request OR ID of user
	 * Status code is used to filter
	 * Lessor is used to get requests for lessor view
	 */
	public static getRequest(request_info: {
		request_id?: string,
		user_id?: string,
		status_code?: number,
		lessor?: boolean
	}): Query {
		if (request_info.request_id) {
			return {
				query: "SELECT request_id, user_id, offer_id, request.status_id as status_id, from_date, to_date, message, qr_code_id FROM request WHERE request_id = ? ORDER BY created_on DESC;",
				args: [
					request_info.request_id
				]
			}
		} else if (request_info.user_id) {
			if (request_info.status_code) {
				if (request_info.lessor) {
					return {
						query: "SELECT request_id, request.user_id, request.offer_id, request.status_id as status_id, from_date, to_date, message, qr_code_id FROM request INNER JOIN offer ON request.offer_id = offer.offer_id WHERE offer.user_id = ? AND ( request.status_id >= ? OR request.status_id = ? ) ORDER BY request.created_on DESC;",
						args: [
							request_info.user_id,
							request_info.status_code,
							3
						]
					}
				} else {
					return {
						query: "SELECT request_id, user_id, offer_id, request.status_id as status_id, from_date, to_date, message, qr_code_id, created_on FROM request WHERE user_id = ? AND (request.status_id >= ? OR request.status_id = ?)  ORDER BY created_on DESC;",
						args: [
							request_info.user_id,
							request_info.status_code,
							3
						]
					}
				}

			} else {
				if (request_info.lessor) {
					return {
						query: "SELECT request_id, request.user_id, request.offer_id, request.status_id as status_id, from_date, to_date, message, qr_code_id FROM request INNER JOIN offer ON request.offer_id = offer.offer_id WHERE offer.user_id = ? AND (request.status_id < ? AND request.status_id != ?) ORDER BY request.created_on DESC;",
						args: [
							request_info.user_id,
							5,
							3
						]
					}
				} else {
					return {
						query: "SELECT request_id, user_id, offer_id, request.status_id as status_id, from_date, to_date, message, qr_code_id FROM request WHERE user_id = ? AND (request.status_id < ? AND request.status_id != ?) ORDER BY created_on DESC;",
						args: [
							request_info.user_id,
							5,
							3
						]
					}
				}
			}
		}
	}

	/**
	 * Returns User ratings given either a rating_id, a user_id (to later check whether a user has already rated another user), or ratings for a single user
	 * @param search 
	 */
	public static getRating(
		search: {
			rating_id?: number,
			user_pair?: {
				rating_user_id: string,
				rated_user_id: string,
				rating_typ: string
			},
			rated_user_id?: string
		}
	): Query {
		if (search.rating_id) {
			return {
				query: "SELECT * FROM rating WHERE rating_id = ?;",
				args: [
					search.rating_id
				]
			}
		} else if (search.user_pair) {
			return {
				query: "SELECT * FROM rating WHERE rating_user_id = ? AND rated_user_id = ? AND rating_type = ?;",
				args: [
					search.user_pair.rating_user_id,
					search.user_pair.rated_user_id,
					search.user_pair.rating_typ
				]
			}
		} else if (search.rated_user_id) {
			return {
				query: "SELECT * FROM rating WHERE rated_user_id = ?",
				args: [
					search.rated_user_id
				]
			}
		}
	}

	/**
	 * Creates a new entry on the DB containing given rating information for a user
	 * @param rating_user_id 
	 * @param rating 
	 */
	public static createUserRating(
		rating_user_id: string,
		rating: {
			user_id: string,
			rating_type: string,
			rating: number,
			headline: string,
			text: string
		}
	): Query {
		return {
			query: "INSERT INTO rating (rating_user_id, rated_user_id, rating_type, rating, headline, rating_text, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_DATE);",
			args: [
				rating_user_id,
				rating.user_id,
				rating.rating_type,
				rating.rating,
				rating.headline,
				rating.text
			]
		}
	}

	/**
	 * Calculates a user's lessor and lessee rating, can be used together with setNewUserRating
	 * @param user_id 
	 */
	public static calculateUserRating(user_id: string): Query {
		return {
			query: "SELECT rated_user_id, rating_type, count(rating_type) as rating_count, sum(rating) as rating_sum, ROUND((sum(rating) / count(rating_type)), 1) as average FROM rating WHERE rated_user_id = ? GROUP BY rating_type;",
			args: [
				user_id
			]
		}
	}

	/**
	 * Updates a user's rating fields using precomputed rating results
	 * @param user_id 
	 * @param lessor_rating 
	 * @param number_of_lessor_ratings 
	 * @param lessee_rating 
	 * @param number_of_lessee_ratings 
	 */
	public static setNewUserRating(user_id: string, lessor_rating: number, number_of_lessor_ratings: number, lessee_rating: number, number_of_lessee_ratings: number): Query {
		return {
			query: "UPDATE user SET lessor_rating = ?, number_of_lessor_ratings = ?, lessee_rating = ?, number_of_lessee_ratings = ? WHERE user_id = ?;",
			args: [
				lessor_rating,
				number_of_lessor_ratings,
				lessee_rating,
				number_of_lessee_ratings,
				user_id
			]
		}
	}

	/**
	 * Dynamically builds a query retrieving user ratings given URL query params
	 * @param user_id 
	 * @param rating_type 
	 * @param rating 
	 */
	public static getUserRatings(user_id: string, rating_type?: string, rating?: string, page_size?: number, page?: number): Query {
		let query = "SELECT * FROM rating WHERE rated_user_id = ?";
		let args: any[] = [user_id];

		if (rating_type) {
			query += " AND rating_type = ?";
			args.push(rating_type);
		}

		if (rating) {
			query += " AND rating = ?";
			args.push(rating);
		}

		if (page_size && page) {
			query += " LIMIT ? OFFSET ?";
			args.push(page_size);
			args.push(page_size * (page - 1));
		} else {
			query += " LIMIT 10 OFFSET 0";
		}

		query += ";";

		return {
			query: query,
			args: args
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