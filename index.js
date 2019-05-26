require('dotenv').config();

const bodyParser = require('body-parser');
const passport = require("passport");
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
console.log(process.env.NODE_PATH)
var api = {
  init: async ({dbConfig={}}) => {
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

        const dbConnection = mysql.createConnection({...mysqlCredentials[process.env.NODE_ENV], multipleStatements: true});
    }
    else if (dbConfig.type === 'postgresql') {

    }

    var sharedExports = {db: require('db/db')({dbConnection})};

    // Misc final setup

    var port = (process.env.NODE_ENV === 'test' ? (process.env.TEST_PORT || 3202) : (process.env.PORT || 3201));

    app.listen(port, () => console.log(`Weflow API [wf-api] running on port ${port}`));// eslint-disable-line

    dbConnection.connect((error) => {
      if (error) {
        //istanbul ignore next
        console.log('Database connection error');
      }
      else {
        _.forEach(['resources', 'auth'], routeKey => {
          require(`routes/${routeKey}/${routeKey}`).init(db)
        });

        if (process.env.NODE_ENV !== 'test') {
          console.log('Database Connected!');
        }

        app.get('/status', (request, response) => response.send({success: true}));
      }
    });


  }
}

module.exports = api;
