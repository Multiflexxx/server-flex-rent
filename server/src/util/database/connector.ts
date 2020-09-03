 import { InternalServerErrorException } from '@nestjs/common';
 
 export class Connector {
  private static mariadb = require('mariadb');
  private static credentials: any = '../../../database.json';
  private static pool: any = Connector.mariadb.createPool(
    {
      host: Connector.credentials.host,
      port: Connector.credentials.port,
      user: Connector.credentials.user,
      password: Connector.credentials.password,
      database: Connector.credentials.database,
      connectionLimit: Connector.credentials.connectionLimit
    });

    // TODO: Create functions
    
    public static async executeQuery(): Promise<any> {
      let result = null;
      try {
        result = await Connector.pool.getConnection().query("Select * From Test");
      } catch(err) {
        throw new InternalServerErrorException("Something went wrong");
      } finally {
        // Close connection
        result.release();
      }
      

    }

}