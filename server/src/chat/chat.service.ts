import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, InternalServerErrorException, NotImplementedException, UnauthorizedException } from '@nestjs/common';
import { UserSession } from 'src/user/user-session.model';
import { UserService } from 'src/user/user.service';
import { Connector } from 'src/util/database/connector';
import { QueryBuilder } from 'src/util/database/query-builder';
import * as StaticConsts from 'src/util/static-consts';
import { ChatMessage } from './chat-message.model';
import { v4 as uuidv4 } from 'uuid';
import { User } from 'src/user/user.model';
import { OfferService } from 'src/offer/offer.service';
import { Chat } from './chat.model';
import { Query } from 'src/util/database/query.model';
import { uuid } from 'uuidv4';

@Injectable()
export class ChatService {

    constructor(
        private readonly userService: UserService,
        private readonly offerService: OfferService
    ) { }

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
        if (!session || !session.session_id || !session.user_id) {
            throw new BadRequestException("Invalid request parameters (session)")
        }

        if (!message
            || !message.chat_id
            || !message.from_user_id
            || !message.message_content
            || !message.message_type
            || !message.to_user_id) {
            throw new BadRequestException("Invalid request parameters (message)");
        }

        // Validate Session and user_ids
        let userFrom = await this.userService.validateUser({ session: session });
        let userTo = await this.userService.getUser(message.to_user_id, StaticConsts.userDetailLevel.PUBLIC);

        // Check chatId
        const chatId: string = this.calculateChatId(userFrom.user.user_id, userTo.user_id)
        if (message.chat_id != chatId) {
            throw new BadRequestException("Invalid request parameters (chat)");
        }

        // Check if user is allowed to send messages
        let requestCount: number = (await Connector.executeQuery(QueryBuilder.checkIfUsersHaveAnOpenOfferRequest(message.from_user_id, message.to_user_id)))[0].number_of_requests;

        if (requestCount == StaticConsts.CHECK_ZERO) {
            throw new ForbiddenException("Cannot chat with users without accepted offer requests");
        }

        let newIndexDB: Array<{
            message_count: number
        }> = await Connector.executeQuery(QueryBuilder.getMessageIndex());

        let newIndex = (!newIndexDB || newIndexDB.length === StaticConsts.CHECK_ZERO || !newIndexDB[0] ? 0 : newIndexDB[0].message_count) + 1;

        // Write chat message to DB
        const messageId: string = chatId + uuidv4();
        await Connector.executeQuery(QueryBuilder.writeChatMessageToDb(messageId, message, newIndex));

        message.message_id = messageId;
        message.status_id = StaticConsts.MESSAGE_STATUS.SENT;
        message.created_at = new Date();

        return message;
    }


    /**
     * Used to get chat messages by chat id
     * @param id id of chat
     * @param reqBody authentication of user
     */
    public async getMessagesByChatId(
        chatId: string,
        session: UserSession,
        query: {
            page: number
        }
    ): Promise<{
        messages: Array<ChatMessage>,
        current_page: number,
        max_page: number,
        messages_per_page: number,
        chat_partner: User
    }> {
        // Check user + session
        if (!chatId || !session || !session.session_id || session.user_id) {
            throw new BadRequestException("Invalid request parameters");
        }

        // Check query parameters
        if (!query || !query.page || isNaN(query.page)) {
            throw new BadRequestException("Invalid request parameters");
        }

        // Validate user session
        let validatedUser: { user: User, session_id: string } = await this.userService.validateUser({ session: session });

        // Check if session authorizes access to that chat
        if (!chatId.includes(validatedUser.user.user_id)) {
            throw new UnauthorizedException("Unauthorized");
        }

        // Get number of chat messages
        let result: {
            message_count: number
        } = (await Connector.executeQuery(QueryBuilder.getNumberMessagesInChat(chatId)))[0];

        let messageCount: number;
        if (!result) {
            messageCount = 0;
        } else {
            messageCount = result.message_count;
        }

        // Calculate max page count
        const maxPage: number = Math.ceil(messageCount / StaticConsts.MESSAGES_PER_PAGE);

        if (query.page > maxPage) {
            throw new BadRequestException("Ran out of pages");
        }

        // Get Messages from DB
        let messages: Array<ChatMessage> = await Connector.executeQuery(QueryBuilder.getMessagesByChatId(chatId, StaticConsts.MESSAGES_PER_PAGE, query.page));

        // Get from and to user
        const chatPartnerId: string = this.getSecondsUserFromChatId(chatId, session.user_id);
        const chatPartner: User = await this.userService.getUser(chatPartnerId, StaticConsts.userDetailLevel.CONTRACT);

        return {
            messages: messages,
            current_page: query.page,
            max_page: maxPage,
            messages_per_page: StaticConsts.MESSAGES_PER_PAGE,
            chat_partner: chatPartner
        };
    }


    /**
     * Returns an array of chats (chatId, chat partner, last message)
     * @param userId user to retrieve the chats for
     * @param session user session
     * @param query query object containing paging information
     */
    public async getChatsForUser(
        userId: string,
        session: UserSession,
        query: {
            page: number
        }
    ): Promise<{
        chats: Array<Chat>,
        current_page: number,
        max_page: number,
        chats_per_page: number,
    }> {

        // Check for missing parameters
        if (!userId
            || !session
            || !session.session_id
            || !session.user_id
            || !query
            || !query.page
            || isNaN(query.page)) {
            throw new BadRequestException("Invalid request parameters");
        }

        // Validate Session
        const validatedUser: { user: User, session_id: string } = await this.userService.validateUser({ session: session });

        if (validatedUser.user.user_id != userId) {
            throw new UnauthorizedException("Unauthorized");
        }

        // TAKE A LOOK AT THIS QUERY:
        // REPLACE ids with ?
        /*
        SELECT DISTINCT message_id, chat_id, from_user_id, to_user_id, message_content, message_type, status_id, created_at FROM message WHERE from_user_id = "0372447f-f74a-4ed4-ae12-6bb25c96c939" OR to_user_id = "0372447f-f74a-4ed4-ae12-6bb25c96c939" AND created_at = (SELECT MAX(created_at)) GROUP BY chat_id;
        */

        // Get most recent messages for each chat for user
        const recentMessages: ChatMessage[] = await Connector.executeQuery(QueryBuilder.getChatsByUserId(userId, StaticConsts.CHATS_PER_PAGE, query.page));

        if (recentMessages.length === 0) {
            throw new BadRequestException("Ran out of pages");
        }

        let chats: Chat[] = [];

        for(let message of recentMessages) {
            chats.push({
                chat_id: message.chat_id,
                chat_partner: await this.userService.getUser(this.getSecondsUserFromChatId(message.chat_id, userId), StaticConsts.userDetailLevel.CONTRACT),
                last_message: message,
                unread_messages: message.from_user_id != userId && message.status_id === StaticConsts.MESSAGE_STATUS.SENT
            });
        }

        let numberOfChatsFromDb: Array<{
            number_of_chats: number
        }> = await Connector.executeQuery(QueryBuilder.getNumberOfChatsForUser(validatedUser.user.user_id));

        let numberOfChats: number = 0;
        if (numberOfChatsFromDb.length > StaticConsts.CHECK_ZERO) {
            numberOfChats = numberOfChatsFromDb[0].number_of_chats;
        }

        return {
            chats: chats,
            current_page: query.page,
            max_page: Math.ceil(numberOfChats / StaticConsts.CHATS_PER_PAGE), // Could work I guess
            chats_per_page: StaticConsts.CHATS_PER_PAGE
        }
    }

    public async sendSystemMessage() { }


    public async generateTestData() {
        const text: string = "Hello world";
        let userIds: string[] = [
            "2cb93d70-8ae8-4667-bdc2-cfee559db81d",
            "0372447f-f74a-4ed4-ae12-6bb25c96c939",
            "125d61fd-0fa5-444e-b368-2c3c509cc2af",
            "0bb5b8f3-6c05-4387-bc99-9afd64dc5243",
            "32e97524-21a2-4d98-a8f1-5a5e27ed1b17",
            "3fcb1a3a-e890-4df5-a48f-1f2306b1364c",
            "9721b024-6143-431d-8098-912a79c2c0b6"
        ];

        userIds.forEach(async userId => {
            console.log(userId)
            await this.userService.getUser(userId);
        })


        let count = 2
        for(let i = 0; i < 1000; i++) {
            let query: Query = {
                query: "INSERT INTO message (message_id, chat_id, from_user_id, to_user_id, message_content, message_type, status_id, message_count) VALUES ",
                args: []
            }
            for(let j = 0; j < 1000; j++) {
                
                let start = Math.floor(Math.random() * 6);
                let userPair: string[] = userIds.slice(start, start+2)
                userPair = this.shuffle(userPair);
                let message;
                message = {
                    chat_id: this.calculateChatId(userPair[0], userPair[1]),
                    from_user_id: userPair[0],
                    to_user_id: userPair[1],
                    message_content: text + uuidv4(),
                    message_type: -1,
                    status_id: -1,
                    message_id: this.calculateChatId(userPair[0], userPair[1]) + uuidv4(),
                }

                query.query += `("${message.message_id}", "${message.chat_id}", "${message.from_user_id}", "${message.to_user_id}", "${message.message_content}", ${message.message_type}, ${message.status_id}, ${count}),`;
                count++;
            }
            query.query = query.query.slice(0, -1) + ';';
            await Connector.executeQuery(query);
        }
    }


    /**
     * Takes two userIds as input and calculates the chatId
     * @param userOne 
     * @param userTwo 
     */
    private calculateChatId(userOne: string, userTwo: string): string {
        return [userOne, userTwo].sort().join("");
    }

    /**
     * Returns the second userId from a chat
     * @param chatId ID of chat
     * @param firstUser known user
     */
    private getSecondsUserFromChatId(chatId: string, firstUser: string): string {
        // Remove first user from chatId and return
        return chatId.replace(firstUser, "");
    }


    private shuffle(a) {
        var j, x, i;
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }
        return a;
    }
}