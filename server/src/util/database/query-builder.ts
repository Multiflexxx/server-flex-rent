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

	public static testQuery() {
		return {
			query: "SELECT * FROM place WHERE place_id = 100000000000;",
				args: [
				]
		}
	}
}