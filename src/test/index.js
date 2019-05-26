/* istanbul ignore file */

const chai = require('chai');
const chaiHttp = require('chai-http');

chai.use(chaiHttp);

var {app, db} = require('../index');

var request = ({uri, params, method='post'}) => {
  return new Promise((resolve) => {
    var chaiRequest = chai.request(app)[method](uri);

    if (params) chaiRequest.send(params);

    chaiRequest.end((error, response) => resolve(response));
  });
};

global.test = {app, db};
global.chai = chai;
global.request = request;
global.expect = chai.expect;
global.mock = require('./mock');

global.test.asyncExpectQueryCount = async ({toEqual: expectedCount, after: fn}) => {
  db.queryCount = 0;

  await fn();

  expect(db.queryCount).to.equal(expectedCount);
};

beforeEach((done) => {
  if (process.env.NODE_ENV === 'test') {
    db.query('SHOW TABLES').then(tableNames => {
      var promises = [];

      _.forEach(tableNames, tableName => {
        tableName = tableName.Tables_in_henrybuilt_test;

        if (tableName !== 'ar_internal_metadata') {
          promises.push(db.query(`DELETE FROM ${tableName}`));
          //promises.push(db.query(`ALTER TABLE ${tableName} AUTO_INCREMENT = 1`));
        }
      });

      Promise.all(promises).then(() => done());
    });
  }
});
