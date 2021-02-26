import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, InternalServerErrorException, NotImplementedException } from '@nestjs/common';
import { UserSession } from 'src/user/user-session.model';
import { UserService } from 'src/user/user.service';
import { Connector } from 'src/util/database/connector';
import { QueryBuilder } from 'src/util/database/query-builder';
import * as StaticConsts from 'src/util/static-consts';
import { ChatMessage } from './chat-message.model';
import { v4 as uuidv4 } from 'uuid';
import { User } from 'src/user/user.model';
import { OfferService } from 'src/offer/offer.service';
import { Offer } from 'src/offer/offer.model';

@Injectable()
export class ChatService {

    constructor(
		private readonly userService: UserService,
        private readonly offerService: OfferService
	) {}

    /**
     * Used to upload chat pictures
     * @param reqBody authentication of users and chatmessage
     * @param images image files
     */
    public async uploadPictures(
        reqBody: {
            session?: UserSession,
            message?: ChatMessage
        },
        images: any
    ): Promise<ChatMessage> {
        throw new NotImplementedException("Not implemented yet!");
    }


    /**
     * Receives a message from the client and uploads it to the server
     * @param reqBody Authentication of user and chat message
     */
    public async receiveChatMessage(
        session: UserSession,
        message: ChatMessage
    ): Promise<ChatMessage> {
        
        // Check request parameters
        if(!session || !session.session_id || !session.user_id) {
            throw new BadRequestException("Invalid request parameters (session)")
        }

        if(!message 
            || !message.chat_id 
            || !message.from_user_id 
            || !message.message_content 
            || !message.message_type 
            || !message.status_id 
            || !message.to_user_id) {
                throw new BadRequestException("Invalid request parameters (message)");
        }

        // Validate Session and user_ids
        let userFrom = await this.userService.validateUser({session: session});
        let userTo = await this.userService.getUser(message.to_user_id, StaticConsts.userDetailLevel.PUBLIC);

        // Check chatId
        const chatId: string = this.calculateChatId(userFrom.user.user_id, userTo.user_id)
        if(message.chat_id != chatId) {
            throw new BadRequestException("Invalid request parameters (chat)");
        }

        // Check if user is allowed to send messages
        let requestCount: number = (await Connector.executeQuery(QueryBuilder.checkIfUsersHaveAnOpenOfferRequest(message.from_user_id, message.to_user_id)))[0].number_of_requests;

        if (requestCount == StaticConsts.CHECK_ZERO) {
            throw new ForbiddenException("Cannot chat with users without accepted offer requests");
        }

        // Write chat message to DB
        const messageId: string = chatId + uuidv4()
        await Connector.executeQuery(QueryBuilder.writeChatMessageToDb(messageId, message));

        message.message_id = messageId;

        return message
    }


    /**
     * Used to get chat messages by chat id
     * @param id id of chat
     * @param reqBody authentication of user
     */
    public async getMessagesByChatId(
        chatId: string, 
        session: UserSession
    ): Promise<{
        messages: Array<ChatMessage>,
		current_page: number,
		max_page: number,
		messages_per_page: number,
        from_user: User,
        to_user: User
    }> {
        // Check parameter
        if(!chatId || !session || !session.session_id || session.user_id) {
            throw new BadRequestException("Invalid request parameters");
        }

        // Validate user session
        let user = this.userService.validateUser({session: session});
        throw new NotImplementedException("Not implemented yet!");
    }



    /**
     * Takes two userIds as input and calculates the chatId
     * @param userOne 
     * @param userTwo 
     */
    private calculateChatId(userOne: string, userTwo: string): string {
        return [userOne, userTwo].sort().join("");
    }
}
