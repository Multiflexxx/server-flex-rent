import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Connector } from 'src/util/database/connector';
import { QueryBuilder } from 'src/util/database/query-builder';

@Injectable()
export class OfferService {
    public async getHomePageOffers() {
        throw new Error("Method not implemented.");
    }

    /**
     * Returns an array of offer objects matching the given filter criteria
     * @param query query wich is send to server
     * If a parameter called 'limit' with a value greater 0 is provided,
     * the limit is used for the return
     * If a parameter called 'filters' with comma seperated values containing
     * a key, an operator and a value is provided,
     * the filters are used on the database-query
     * (Schema: filters=<key><operator><value>,<key><operator><value>)
     */
    public async getAll(query: {
        limit?: number,
        filters?: string
    }) {
        let limit: number = 25; // Default limit
        let filters: Array<{key: string, operator: string, value: string}> = [];
        
        if(query.limit !== null && query.limit !== undefined && +query.limit > 0) {
            // Update limit, if given
            // Typecast the querystring into a number using the unary '+'-operator
            // see https://stackoverflow.com/questions/14667713/how-to-convert-a-string-to-number-in-typescript
            // for more information 
            limit = +query.limit;
        }
        if(query.filters !== null && query.filters !== undefined) {
            // TODO: CHECK INCOMING QUERY
            query.filters.split(',').map(filter => {
                let operatorPosition = this.getOperatorPosition(filter);

                if(operatorPosition.start === -1) {
                    throw new BadRequestException("Wrong filter");
                }
                let o = {
                    key: filter.substring(0, operatorPosition.start),
                    operator: filter.substring(operatorPosition.start, operatorPosition.end+1),
                    value: filter.substring(operatorPosition.end+1)
                }

                filters.push(o);
            });
        }

        let offers = await Connector.executeQuery(
            QueryBuilder.getOffer({
                query: {
                    limit: limit,
                    filters: filters
                }
            }));
        
        if(offers.length > 0) {
            return offers;
        } else {
            throw new NotFoundException("No offers found");
        }
    }

    /**
     * Returns an offer object containing the offer by ID.
     * @param id ID of offer to be found
     */
    public async getOfferById(id: number) {
        let offer = await Connector.executeQuery(QueryBuilder.getOffer({offer_id: id}));
        if(offer.length !== 0) {
            return offer;
        } else {
            throw new NotFoundException("Offer not found");
        }
    }

    public async createOffer(reqBody: {}) {
        throw new Error("Method not implemented.");
    }

    public async updateOffer(id: any, reqbody: any) {
        throw new Error("Method not implemented.");
    }

    public async bookOffer(id: number, reqBody: {}) {
        throw new Error("Method not implemented.");
    }

    public async deleteOffer(id: any, reqBody: any) {
        throw new Error("Method not implemented.");
    }
    
    /**
     * Method to get the position of the operator in a given filter string
     * @param filterString Accepts a String in format '<key><operator><value>'
     * @returns {start: number, end?: number} Returns an object with start and end position of operator
     */
    private getOperatorPosition(filterString: string): {
        start: number, 
        end?: number
    } {
        if(filterString.indexOf('<=', 0) > -1) {
            return {
                start: filterString.indexOf('<=', 0),
                end: (filterString.indexOf('<=', 0)+1)
            };
        } else if(filterString.indexOf('>=', 0) > -1) {
            return {
                start: filterString.indexOf('>=', 0),
                end: (filterString.indexOf('>=', 0)+1)
            };
        } else if(filterString.indexOf('=') > -1) {
            return {
                start: filterString.indexOf('='),
                end: filterString.indexOf('=')
            };
        } else if(filterString.indexOf('<') > -1) {
            return {
                start: filterString.indexOf('<'),
                end: filterString.indexOf('<')
            };
        } else if(filterString.indexOf('>') > -1) {
            return {
                start: filterString.indexOf('>'),
                end: filterString.indexOf('>')
            };
        } else {
            return {start: -1 }
        } 
    }
}
