require('module-alias/register');
require('henrybuilt-js-library'); //makes lib global variable
require('dotenv').config();

const mysqlCredentials = require('../config/mysql');
const bodyParser = require('body-parser');
const passport = require("passport");
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const _ = require('lodash');

// Globals
//henrybuilt-js-library makes its own global reference
global._ = _;

global.log = (...args) => {
  //istanbul ignore next
  if (process.env.NODE_ENV !== 'test') alwaysLog(...args);
};

global.alwaysLog = (...args) => {
  //istanbul ignore next
  console.log(...args); //eslint-disable-line
};

// App setup
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

// Misc final setup
const dbConnection = mysql.createConnection({...mysqlCredentials[process.env.NODE_ENV], multipleStatements: true});
const sharedExports = {app, db: require('../lib/db/db')({dbConnection})};

(async () => {
  var port = (process.env.NODE_ENV === 'test' ? (process.env.TEST_PORT || 3102) : (process.env.PORT || 3101));

  app.listen(port, () => console.log(`henrybuilt-api running on port ${port}`));// eslint-disable-line

  dbConnection.connect((error) => {
    if (error) {
      //istanbul ignore next
      alwaysLog('Database connection error');
    }
    else {
      _.forEach(['resources', 'auth'], routeKey => require(`../routes/${routeKey}/${routeKey}`).init(sharedExports));

      log('Database Connected!');

      app.get('/status', (request, response) => response.send({success: true}));
    }
  });
})();


module.exports = sharedExports;
