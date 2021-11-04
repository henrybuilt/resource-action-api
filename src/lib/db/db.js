var {singularize} = require('inflection');
var chalk = require('chalk');

module.exports = ({dbConnection, dbConfig, schemas, relationships, middleware, permissions}) => {
  var dbConnection = dbConnection;

  var query = (string, args=[], {shouldLog=true}={}) => {
    return new Promise((resolve, reject) => {
      var startTime = Date.now();

      if (dbConfig.type === 'postgresql') {
        var x = string.split('?');

        var newString = [];

        _.forEach(x, (s, index) => {
          newString.push(s);

          if (index !== x.length - 1) {
            newString.push(`$${index + 1}`);
          }
        });

        string = newString.join('');
      }

      dbConnection.query(string, args, (error, result) => {
        var endTime = Date.now();
        var deltaTime = endTime - startTime;

        if (process.env.NODE_ENV !== 'test' && shouldLog) {
          var color = deltaTime > 50 ? 'red' : 'green';

          log(`  query: (${deltaTime}ms) `, chalk[color](string));

          if (deltaTime > 200) {
            console.trace('logging trace to help debug slow query');
          }

          if (process.env.NODE_ENV !== 'production' && args) {
            log(`  args: `, chalk[color](lib.json.stringify(args)));
          }
        }

        /* istanbul ignore if */
        if (error) {
          console.log(string, args); //eslint-disable-line
          console.log(error); //eslint-disable-line

          reject(error);
        }
        else {
          if (dbConfig.type === 'postgresql') {
            result = result.rows;
          }

          resolve(result);
        }
      });
    });
  };

  var db = {
    queryCount: 0,

    query(string, args, {shouldLog=true, logs}={}) {
      db.queryCount += 1;

      if (shouldLog) {
        var queryLogs = logs || [];

        queryLogs.push({items: [` Query string:   `, chalk.cyan(string)]});

        if (process.env.NODE_ENV !== 'production') {
          queryLogs.push({items: [`         args:   `, chalk.cyan(lib.json.stringify(args))]});
        }

        if (!logs) _.forEach(queryLogs, ({items}) => {
          if (process.env.NODE_ENV !== 'test') {
            console.log(...items);
          }
        });
      }

      return query(string, args, {shouldLog, logs});
    },

    async execute({actionKey, resourceKey, params}, options) {
      var executor = new db.Executor({actionKey, resourceKey, params, options});

      return await executor.execute();
    },

    get(resourceKey, params={}, options) {
      if (!Array.isArray(params) && params.id !== undefined) {
        return db.execute({actionKey: 'get', resourceKey: singularize(resourceKey), params: {where: {id: params.id}}}, options);
      }
      else {
        return db.execute({actionKey: 'get', resourceKey, params}, options);
      }
    },

    create(resourceKey, props={}, options) {
      if (Array.isArray(props)) {
        return Promise.all(_.map(props, props => {
          return db.execute({actionKey: 'create', resourceKey, params: {props}}, options);
        }));
      }
      else {
        return db.execute({actionKey: 'create', resourceKey, params: {props}}, options);
      }
    },

    update(resourceKey, params={}, options) {
      if (Array.isArray(params)) {
        return Promise.all(_.map(params, params => {
          return db.execute({actionKey: 'update', resourceKey, params}, options);
        }));
      }
      else {
        return db.execute({actionKey: 'update', resourceKey, params}, options);
      }
    },

    destroy(resourceKey, params={}, options) {
      return db.execute({actionKey: 'destroy', resourceKey, params}, options);
    }
  };

  db.Executor = require('./executor')({db, dbConfig, schemas, relationships, middleware, permissions});

  return db;
};
