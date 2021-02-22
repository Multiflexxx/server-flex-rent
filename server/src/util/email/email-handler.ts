import { InternalServerErrorException } from '@nestjs/common';
import { EmailResponse } from './email-response.model';


export class EmailHandler {
    private static nodeMailer = require('nodemailer');
    private static transporterConfig = require('../../../email.json');

    private static transporter = EmailHandler.nodeMailer.createTransport(EmailHandler.transporterConfig);

    /**
     * Method to send the verification email to users
     * @param recipient email of receiver
     * @param userName name of user
     * @param subject subject of mail
     * @param link verification link
     * 
     * @returns returns an EmailResponse object if email was sent successfully
     */
    public static async sendVerificationEmail(
        recipient: string,
        userName: string,
        link: string):
        Promise<EmailResponse> {

            const subject: string = "Bestätige jetzt deine FlexRent Email-Adresse";

        // Email Body
        let htmlBody = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style> .btn {background-color: #9C27B0; border: none; color: #fff; padding: 7px 16px; text-align: center; text-decoration: none; display: inline-block; } .btn:hover {background-color: rgba(156, 39, 176, 0.90); } .main {background-color: #202020; width: 50%; margin: 0 auto; padding: 25px;} a {margin-top: 10px;} body {background-color: #000000; color: #fff; font-family: 'Roboto', sans-serif;} </style><link href="http://fonts.googleapis.com/css?family=Roboto" rel="stylesheet" type="text/css"></head><body><div class="main"><h3>Hallo ${userName},</h3><p>bitte bestätige Deine E-Mail-Adresse:</p><a href="${link}" class="btn">Bestätigen</a><br><p>Alternativ kannst Du auch diese URL in deinen Webbrowser kopieren und<br>die Seite öffnen:<br><br>${link}<br><br>Wir wünschen Dir viel Spaß bei der Nutzung!<br><br>Dein Multiflexxx-Team</p></div></body></html>`;
        
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
            console.error(err);
            throw new InternalServerErrorException("Something went wrong");
        }

        return result;
    }

    public static async sendPasswordResetEmail(
        recipient: string,
        userName: string,
        resetCode: string
    ): Promise<EmailResponse> {

        const subject: string = "Setze dein Flexrent Passwort zurück"

        let htmlBody: string = `<!DOCTYPE html><html lang="de"><head> <meta charset="utf-8"> <meta name="viewport" content="width=device-width, initial-scale=1.0"> <style>.main{background-color: #202020; width: 50%; margin: 0 auto; padding: 25px;}a{margin-top: 10px;}body{background-color: #000000; color: #fff; font-family: 'Roboto', sans-serif;}.code{background-color: #9C27B0; color: #fff; font-size: large; text-align: center; letter-spacing: 15px; margin-top: 10px; height: 50px; width: 200px; line-height: 50px;}</style> <link href="http://fonts.googleapis.com/css?family=Roboto" rel="stylesheet" type="text/css"></head><body> <div class="main"> <h3>Hallo ${userName},</h3> <p>für deinen Nutzer wurde das Zurürcksetzen des Passworts beantragt. <br>Für das Zurücksetzen deines Passworts, gib bitte die folgenden Bestätigungscode in deiner App oder der Webseite ein.</p><div class=code> ${resetCode}</div><p>Der Code ist für eine Stunde gültig. <br>Falls du das Zurücksetzen deines Passwords nicht selbst beantragt hast, kannst du diese Email ignorieren.</p><p> Viele Grüße, <br>Dein FlexRent Team </p></div></body></html>`
        
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
            console.error(err);
            throw new InternalServerErrorException("Something went wrong");
        }
        
        return result;
    }

    //TODO: Create Methods to send other Emails
}