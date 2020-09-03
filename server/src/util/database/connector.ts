export class Connector {
  mariadb = require('mariadb');
  credentials: any = '../../../database.json';
  pool: any = this.mariadb.createPool(
    {
      host: this.credentials.host,
      port: this.credentials.port,
      user: this.credentials.user,
      password: this.credentials.password,
      database: this.credentials.database,
      connectionLimit: this.credentials.connectionLimit
    });

    // TODO: Create functions

}