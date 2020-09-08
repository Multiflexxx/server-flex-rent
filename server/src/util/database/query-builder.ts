import { User } from "src/user/user.model";
import { Query } from "./query.model";
import { query } from "express";

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
		if(user_info.user_id) {
			return {
				query: "SELECT * FROM user WHERE user_id = ?;",
				args: [
					user_info.user_id
				]
			}
		} else if(user_info.email) {
			return {
				query: "SELECT * FROM user WHERE email = ?;",
				args: [
					user_info.email
				]
			}
		} else if(user_info.phone) {
			return {
				query: "SELECT * FROM user WHERE phone = ?;",
				args: [
					user_info.phone
				]
			}
		} else if(user_info.login) {
			return {
				query: "SELECT * FROM user WHERE email = ? AND password_hash = ?",
				args: [
					user_info.login.email,
					user_info.login.password_hash
				]
			}
		}
	}

	public static getPlace(
		place_info: {
			place_id?: number,
			post_code?: number
		}
	): Query {
		if(place_info.place_id) {
			return {
				query: "SELECT * FROM place WHERE place_id = ?;",
				args: [
					place_info.place_id
				]
			}
		} else if(place_info.post_code) {
			return {
				query: "SELECT * FROM place WHERE place_id = ?;",
				args: [
					place_info.post_code
				]
			}
		}
	}

	/**
	 * Looks up an offer given an offer_id OR all offers within a limit, or filters
	 * @param offer_info object containing offer information: offer_info.offer_id OR offer_info.query
	 */
	public static getOffer(
		offer_info: {
			offer_id?: number,
			query?: {
				limit: number,
				filters?: Array<{
						key: string,
						operator: string,
						value: string
					}>
			}
		}
	): Query {
		if(offer_info.offer_id) {
			return {
				query: "SELECT * FROM offer WHERE offer_id = ?;",
				args: [
					offer_info.offer_id
				]
			}
		} else if(offer_info.query) {
			if(offer_info.query.filters && offer_info.query.filters.length > 0) {
				let query = "SELECT * FROM offer WHERE ";
				let args = [];

				for(let i = 0; i < offer_info.query.filters.length; i++) {
					query += "? ? ?";
					if(i < offer_info.query.filters.length-1) {
						query += " AND ";
					}
					args.push(
						offer_info.query.filters[i].key,
						offer_info.query.filters[i].operator,
						offer_info.query.filters[i].value,
					);
				}

				if(offer_info.query.limit) {
					query += " LIMIT ?;";
					args.push(offer_info.query.limit);
				} else {
					query += ";"
				}

				return {
					query: query,
					args: args
				}
			} else {
				return {
					query: "SELECT * FROM offer LIMIT ?;",
					args: [
						offer_info.query.limit
					]
				}
			}
		}
	}

	public static getCategory() {
		return {
			query: "SELECT * FROM category;",
			args: []
		}
	}

	public static testQuery() {
		return {
			query: "SELECT * FROM place WHERE place_id = 100000000000;",
				args: [
				]
		}
	}
}