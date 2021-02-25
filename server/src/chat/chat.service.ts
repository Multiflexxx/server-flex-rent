import { Injectable, NotImplementedException } from '@nestjs/common';
import { UserSession } from 'src/user/user-session.model';
import { ChatMessage } from './chat-message.model';

@Injectable()
export class ChatService {

    /**
     * Used to upload chat pictures
     * @param reqBody authentication of users and chatmessage
     * @param images image files
     */
    public async uploadPictures(reqBody: {
        session?: UserSession,
        message?: ChatMessage
    },
    images: any): Promise<ChatMessage> {
        throw new NotImplementedException("Not implemented yet!");
    }

    /**
     * used to get Messages from Client
     * @param reqBody Authentication of user and chat message
     */
    public async receiveChatMessage(reqBody: {
        session?: UserSession,
        message?: ChatMessage
    }): Promise<ChatMessage> {
        throw new NotImplementedException("Not implemented yet!");
    }

    /**
     * Used to get chat messages by chat id
     * @param id id of chat
     * @param reqBody authentication of user
     */
    public async getMessagesByChatId(id: string, reqBody: {
        session?: UserSession
    }): Promise<{
        messages: Array<ChatMessage>,
		current_page: number,
		max_page: number,
		messages_per_page: number
    }> {
        throw new NotImplementedException("Not implemented yet!");
    }
}
