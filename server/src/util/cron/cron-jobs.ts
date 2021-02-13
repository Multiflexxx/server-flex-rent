const schedule = require('node-schedule');
import { Connector } from 'src/util/database/connector';
import { QueryBuilder } from 'src/util/database/query-builder';

export class CronJobs {

    public static async startUserDeletionScan() {
        var job = schedule.scheduleJob('0 0 0 * * 0', function() {
            console.log("Test")
        })
    }

    public static async closeTimedOutOffers() {
        let closeJob = schedule.scheduleJob('0 0 */2 * * *', async function() {
            await Connector.executeQuery(QueryBuilder.closeTimedOutOffers());
        });
    }
}