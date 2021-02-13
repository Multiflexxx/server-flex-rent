import { InternalServerErrorException, NotImplementedException } from '@nestjs/common';
const axios = require('axios');

export class SMSHandler {
    private static smsConfig = require('../../../sms.json');

    public static async sendVerificationSMS(
        phoneNumber: string,
        verificationCode: number):
        Promise<any> {
        let message = `${verificationCode} ist dein Bestaetigungs Code fuer Flexrent.\n@flexrent #${verificationCode}`;

        let messageBody = {
            to: phoneNumber,
            message: message
        };
        let headers = {
            "authorization": SMSHandler.smsConfig.token,
            "Content-Type": "application/json"
        };

        let result;

        try {
            result = await axios.post(`${SMSHandler.smsConfig.url}:${SMSHandler.smsConfig.port}`, messageBody, { headers: headers });
        } catch (err) {
            console.error(err)
            throw new InternalServerErrorException("Something went wrong");
        }

        return result;
    }
}