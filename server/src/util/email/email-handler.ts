import { InternalServerErrorException, NotImplementedException } from '@nestjs/common';


export class EmailHandler {
    private static nodeMailer = require('nodemailer');
    private static transporterConfig = require('../../../email.json');

    private static transporter = EmailHandler.nodeMailer.createTransport(EmailHandler.transporterConfig);

    /**
     * 
     * @param recipient 
     * @param subject 
     * @param link 
     */
    public static async sendVerificationEmail(recipient: string, subject: string, link: string): Promise<any> {
        // Email Body
        let htmlBody = `<h1>Email Bestätigen</h1>Willkommen bei Flexrent. Klicke auf den Link um deine Email-Adresse zu bestätigen.<br><br><a href="${link}">${link}</a>`;
        // Create domain from host
        let domain = `${(EmailHandler.transporterConfig.host).split('.')[1]}.${(EmailHandler.transporterConfig.host).split('.')[2]}`;
        // Create sender
        let from = `${EmailHandler.transporterConfig.auth.user}@${domain}`;

        let mailOptions = {
            from: from,
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

    public static sendTextEmail(recipient: string, subject: string, text: string) {
        throw new NotImplementedException("Method not implemented yet!");
    }
}