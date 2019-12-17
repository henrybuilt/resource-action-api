const auth = require('../../lib/auth/auth');
const {respond} = require('../../lib/request');
const {singularize} = require('inflection');
const chalk = require('chalk');

module.exports = {
  init: ({app, db, schemas, permissions}) => {
    app.post('/resources', async (request, response) => {
      var promises = [], errors = [];
      var token = request.body.token;

      var user = await auth.token.userFor({db, token});
      var logs = [];
      var requestStartTime = Date.now();

      await Promise.all(_.map(request.body.resources, async (action, actionKey) => {
        await Promise.all(_.map(action, async (params, resourceKey) => {
          var hasPermission = await permissions.hasPermissionFor({
            user, resourceKey, actionKey, params, db
          });

          if (hasPermission) {
            var execute = (params) => {
              var promise;

              if (schemas[singularize(resourceKey)]) {
                promise = db.execute({actionKey, resourceKey, params}, {logs})
                  .then(resourceData => ({actionKey, resourceKey, resourceData}))
                  .catch(error => errors.push({message: error.message}));
              }
              else {
                try {
                  var pseudoResourceKey = _.kebabCase(singularize(resourceKey));
                  var pseudoResource = require(`./pseudo/${pseudoResourceKey}/${pseudoResourceKey}`);

                  promise = pseudoResource.actions[actionKey].execute({db})
                    .then(resourceData => ({actionKey, resourceKey, resourceData}));
                }
                catch (error) {
                  promise = new Promise((resolve) => resolve(errors.push({message: `Resource ${resourceKey} does not exist`})));

                  if (process.env.NODE_ENV !== 'test') {
                    console.log(error);
                  }
                }
              }

              return promise;
            };

            if (Array.isArray(params)) {
              promises.push(Promise.all(_.map(params, params => execute(params))).then(results => {
                var resourceData = _.map(_.filter(results, result => result.resourceData), 'resourceData');

                return {actionKey, resourceKey, resourceData};
              }));
            }
            else {
              promises.push(execute(params));
            }
          }
          else {
            var message = `Permission denied for: ${actionKey} ${resourceKey}`;

            if (process.env.NODE_ENV !== 'test') {
              console.log(message);
            }

            errors.push({key: 'permission-denied', message});
          }
        }));
      }));

      var resources = await Promise.all(promises);
      var data = {resources: {get: {}, create: {}}};

      if (!errors.length) {
        _.forEach(resources, ({actionKey, resourceKey, resourceData}) => {
          if (_.includes(['get', 'create'], actionKey)) {
            data.resources[actionKey][resourceKey] = resourceData;
          }
        });
      }

      respond({response, data, errors});

      if (process.env.NODE_ENV !== 'test') {
        console.log('');
        console.log(chalk.inverse(` POST /resources `), chalk.inverse(` ${Date.now() - requestStartTime}ms `),
          new Date(), `userId: ${user ? user.id : '?'}`);

        if (errors.length > 0) {
          _.forEach(errors, ({message}) => console.log(message));
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log(' Request body:   ', chalk.magenta(lib.json.stringify(request.body.resources)));
        }

        //TODO log errors

        _.forEach(logs, ({items}) => console.log(...items));
      }
    });
  }
};
