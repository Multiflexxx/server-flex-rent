-- Place
CREATE TABLE place ( 
	place_id int NOT NULL AUTO_INCREMENT,
	name varchar(50),
	post_code varchar(50),
	PRIMARY KEY (place_id)
);

-- User
CREATE TABLE user (
	user_id varchar(255) NOT NULL,
	first_name varchar(50),
	last_name varchar(50),
	email varchar(50),
	phone_number varchar(25),
	password_hash varchar(255),
	verified bool,
	place_id int NOT NULL,
	street varchar(50),
	house_number varchar(8),
	lessee_rating DECIMAL(8, 2),
	lessor_rating DECIMAL(8, 2),
	date_of_birth DATE,
	PRIMARY KEY (user_id),
	FOREIGN KEY (place_id) REFERENCES place (place_id)
);

-- Category
CREATE TABLE category (
	category_id int NOT NULL AUTO_INCREMENT,
	name varchar(50) NOT NULL,
	picture_link varchar(100),
	PRIMARY KEY (category_id)
);

-- Offer
CREATE TABLE offer (
	offer_id varchar(255) NOT NULL,
	user_id varchar(255) NOT NULL,
	title varchar(100) NOT NULL,
	description varchar(500) NOT NULL,
	rating DECIMAL(8, 2),
	price DECIMAL(8, 2),
	category_id int NOT NULL,
	PRIMARY KEY (offer_id),
	FOREIGN KEY (user_id) REFERENCES user (user_id),
	FOREIGN KEY (category_id) REFERENCES category (category_id)
);

-- Offer-Picture
CREATE TABLE offer_picture (
	uuid varchar(255) NOT NULL,
	offer_id varchar(255) NOT NULL,
	PRIMARY KEY (uuid),
	FOREIGN KEY (offer_id) REFERENCES offer (offer_id)
);

-- Offer-Blocked
CREATE TABLE offer_blocked (
	offer_blocked_id varchar(255) NOT NULL,
	offer_id varchar(255) NOT NULL,
	from_date DATE,
	to_date DATE,
	reason varchar(255),
	PRIMARY KEY (offer_blocked_id),
	FOREIGN KEY (offer_id) REFERENCES offer (offer_id)
);

-- Favourites
CREATE TABLE favourites (
	favourite_id int NOT NULL AUTO_INCREMENT,
	offer_id varchar(255),
	user_id varchar(255),
	PRIMARY KEY (favourite_id),
	FOREIGN KEY (offer_id) REFERENCES offer (offer_id),
	FOREIGN KEY (user_id) REFERENCES user (user_id)
);

-- Status
CREATE TABLE status (
	status_id int NOT NULL AUTO_INCREMENT,
	name varchar(50),
	PRIMARY KEY (status_id)
);

-- Payment-Method
CREATE TABLE payment_method (
	method_id int NOT NULL AUTO_INCREMENT,
	name varchar(50) NOT NULL,
	PRIMARY KEY (method_id)
);

-- Billing-Information
CREATE TABLE billing_method (
	billing_information_id varchar(255) NOT NULL,
	user_id varchar(255) NOT NULL,
	method_id int NOT NULL,
	data varchar(255),
	PRIMARY KEY (billing_information_id),
	FOREIGN KEY (user_id) REFERENCES user (user_id),
	FOREIGN KEY (method_id) REFERENCES payment_method (method_id)
);

-- Request
CREATE TABLE request (
	request_id varchar(255) NOT NULL,
	user_id varchar(255) NOT NULL,
	offer_id varchar(255) NOT NULL,
	status_id int NOT NULL,
	from_date DATE NOT NULL,
	to_date DATE NOT NULL,
	PRIMARY KEY (request_id),
	FOREIGN KEY (user_id) REFERENCES user (user_id),
	FOREIGN KEY (offer_id) REFERENCES offer (offer_id),
	FOREIGN KEY (status_id) REFERENCES status (status_id),
);

-- Payment
CREATE TABLE payment (
	payment_id varchar(255) NOT NULL,
	from_user_id varchar(255) NOT NULL,
	to_user_id varchar(255) NOT NULL,
	from_billing_information_id varchar(255) NOT NULL,
	to_billing_information_id varchar(255) NOT NULL,
	request_id varchar(255) NOT NULL,
	payment_amount DECIMAL(10, 2),
	payment_timestamp TIMESTAMP,
	PRIMARY KEY (payment_id),
	FOREIGN KEY (from_user_id) REFERENCES user (user_id),
	FOREIGN KEY (to_user_id) REFERENCES user (user_id),
	FOREIGN KEY (from_billing_information_id) REFERENCES billing_information (billing_information_id),
	FOREIGN KEY (to_billing_information_id) REFERENCES billing_information (billing_information_id),
	FOREIGN KEY (request_id) REFERENCES request (request_id)
);
