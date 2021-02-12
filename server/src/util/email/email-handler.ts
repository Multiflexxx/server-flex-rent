import { InternalServerErrorException, NotImplementedException } from '@nestjs/common';
import { EmailResponse } from './email-response.model';


export class EmailHandler {
    private static nodeMailer = require('nodemailer');
    private static transporterConfig = require('../../../email.json');

    private static transporter = EmailHandler.nodeMailer.createTransport(EmailHandler.transporterConfig);

    /**
     * Method to send the verification email to users
     * @param recipient email of receiver
     * @param subject subject of mail
     * @param link verification link
     * 
     * @returns returns an EmailResponse object if email was sent successfully
     */
    public static async sendVerificationEmail(
        recipient: string,
        subject: string,
        link: string):
        Promise<EmailResponse> {

        // Email Body
        let htmlBody = `<h1>Email Bestätigen</h1>Willkommen bei Flexrent. Klicke auf den Link um deine Email-Adresse zu bestätigen.<br><br><a href="${link}">${link}</a>`;

        let mailOptions = {
            from: EmailHandler.transporterConfig.auth.user,
            to: recipient,
            subject: subject,
            html: htmlBody
        };

        let result;
        try {
            result = await EmailHandler.transporter.sendMail(mailOptions);
        } catch (err) {
            console.log(err);
            throw new InternalServerErrorException("Something went wrong");
        }

        return result;
    }

    //TODO: Create Methods to send other Emails
}