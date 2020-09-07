 import { InternalServerErrorException } from '@nestjs/common';
 
 export class Connector {
  private static mariadb = require('mariadb');
  private static credentials = require('../../../database.json');
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
    
    public static async executeQuery(q: {query: string, args: any[]}): Promise<any> {
      let result = null;
      let connection = null;
      try {
        connection = await Connector.pool.getConnection();
        result = await connection.query(q.query, q.args);
      } catch(err) {
        console.log(err);
        throw new InternalServerErrorException("Something went wrong");
      } finally {
        // Close connection
        connection.release();
      }
      
      return result;
    }

}