var {singularize} = require('inflection');
var chalk = require('chalk');

module.exports = ({dbConnection}) => {
  var dbConnection = dbConnection;

  var query = (string, args=[]) => {
    return new Promise((resolve, reject) => {
      dbConnection.query(string, args, (error, result) => {
        /* istanbul ignore if */
        if (error) {
          console.log(string, args); //eslint-disable-line
          console.log(error); //eslint-disable-line

          reject(error);
        }
        else {
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

        if (!logs) _.forEach(queryLogs, ({items}) => log(...items));
      }

      return query(string, args);
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

  db.Executor = require('./executor')({db});

  return db;
};
