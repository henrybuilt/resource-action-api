const bodyParser = require('body-parser');
const passport = require('passport');
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const pg = require('pg');

global.log = (...args) => {
  //istanbul ignore next
  if (process.env.NODE_ENV !== 'test') alwaysLog(...args);
};

global.alwaysLog = (...args) => {
  //istanbul ignore next
  console.log(...args); //eslint-disable-line
};

//TODO pseudoResources
//TODO files support
//TODO s3
//TODO mail
var api = {
  init: ({port, dbConfig, schemas, middleware, relationships, permissions, pseudoResources}) => {
    //< server init
    const app = express();

    app.use(express.json({limit: '50mb'}));
    app.use(express.urlencoded({limit: '50mb', extended: false}));
    app.use(cors());
    app.use(passport.initialize());
    app.use((request, response, next) =>  {
      response.header('Content-Type', 'application/json');

      next();
    });
    //> server init

    if (dbConfig.type === 'mysql') {
      var dbConnection = mysql.createConnection({..._.omit(dbConfig, ['type']), multipleStatements: true, timezone: 'UTC'});
    }
    else if (dbConfig.type === 'postgresql') {
      var dbConnection = new pg.Client({..._.omit(dbConfig, ['type'])});
    }

    var db = require('./src/lib/db/db')({dbConnection, dbConfig, schemas, middleware, relationships, permissions});

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
            db, app, schemas, permissions, pseudoResources
          })
        });

        if (process.env.NODE_ENV !== 'test') {
          console.log('Database Connected!');
        }

        app.get('/status', (request, response) => response.send({success: true}));
      }
    });

    var {respond} = require('./src/lib/request');
    var auth = require('./src/lib/auth/auth');

    return {app, db, dbConnection, auth, respond};
  }
};

module.exports = api;
