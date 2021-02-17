const schedule = require('node-schedule');
import { OfferService } from 'src/offer/offer.service';
import { UserService } from 'src/user/user.service';
import { Connector } from 'src/util/database/connector';
import { QueryBuilder } from 'src/util/database/query-builder';

export class CronJobs {

    /**
     * Wrapper to start all cron jobs in server start
     */
    public static async runJobs(): Promise<void> {
        // Register Cron Job here
        const jobs = [
            CronJobs.startUserDeletionScan, 
            CronJobs.closeTimedOutOffers
        ]

        for(let job of jobs) {
            job();
        }
    }

    public static async startUserDeletionScan() {
        schedule.scheduleJob('0 */1 * * * *', async function() {
            await Connector.executeQuery(QueryBuilder.cron_hardDeleteUser());
        });
    }

    public static async closeTimedOutOffers() {
        schedule.scheduleJob('0 0 */2 * * *', async function() {
            await Connector.executeQuery(QueryBuilder.closeTimedOutOffers());
        });
    }
}