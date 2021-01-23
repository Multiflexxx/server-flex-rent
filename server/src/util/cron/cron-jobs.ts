const schedule = require('node-schedule');

export class CronJobs {

    public static async startUserDeletionScan() {
        var job = schedule.scheduleJob('0 0 0 * * 0', function() {
            console.log("Test")
        })
    }
    
}