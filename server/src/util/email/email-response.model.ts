export interface EmailResponse {
    accepted: Array<string>,
    rejected: Array<string>,
    envelopeTime: number,
    messageTime: number,
    messageSize: number,
    response: string,
    envelope: {
        from: string,
        to: Array<string>
    },
    messageId: string
}