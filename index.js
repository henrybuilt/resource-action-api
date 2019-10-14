require('module-alias/register');

const bodyParser = require('body-parser');
const passport = require('passport');
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const pg = require('pg');

var api = {
  init: async ({port, dbConfig={}, schemas, middleware, relationships, permissions}) => {
    //< server init
    const app = express();
    const jsonParser = bodyParser.json({type: () => true});

    app.use(bodyParser.urlencoded({extended: true}));
    app.use(jsonParser);
    app.use(cors());
    app.use(passport.initialize());
    app.use((request, response, next) =>  {
      response.header('Content-Type', 'application/json');

      next();
    });
    //> server init

    if (dbConfig.type === 'mysql') {
      var dbConnection = mysql.createConnection({..._.omit(dbConfig, ['type']), multipleStatements: true});
    }
    else if (dbConfig.type === 'postgresql') {
      var dbConnection = new pg.Client({..._.omit(dbConfig, ['type'])});
    }

    var db = require('./src/lib/db/db')({dbConnection, dbConfig, schemas, middleware, relationships});

    // Misc final setup

    app.listen(port, () => console.log(`API running on port ${port}`));// eslint-disable-line

    dbConnection.connect((error) => {
      if (error) {
        //istanbul ignore next
        console.log('Database connection error: ', error);
      }
      else {
        _.forEach(['resources', 'auth'], routeKey => {
          require(`./src/routes/${routeKey}/${routeKey}`).init({
            db, app, schemas, permissions
          })
        });

        if (process.env.NODE_ENV !== 'test') {
          console.log('Database Connected!');
        }

        app.get('/status', (request, response) => response.send({success: true}));
      }
    });

    return {app, db, dbConnection};
  }
};

module.exports = api;
