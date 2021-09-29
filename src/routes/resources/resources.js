const auth = require('../../lib/auth/auth');
const {respond} = require('../../lib/request');
const {singularize} = require('inflection');
const chalk = require('chalk');
const fileUpload = require('express-fileupload');

module.exports = {
  init: ({app, db, schemas, permissions, pseudoResources}) => {
    app.use(fileUpload());

    app.post('/resources', async (request, response) => {
      var singularResponses = [], errors = [];
      var {body, files} = request;
      var token = body.token;
      var user = token ? await auth.token.userFor({db, token}) : null;
      var logs = [];
      var requestStartTime = Date.now();

      if (files) {
        body.resources = JSON.parse(body.resources);
      }

      if (global.latestValidBuildNumbers && body.appKey && body.appBuildNumber && body.appBuildNumber < global.latestValidBuildNumbers[body.appKey]) {
        errors.push({message: `The version of the app you're using is out of date. Please ${body.isWeb ? 'refresh' : 'update it via the App Store'} to use the latest version.`});
      }
      else {
        var actions = lib.waterfall(body.resources, [
          [_.mapValues, (action, actionKey) => ({action, actionKey})],
          [_.sortBy, ({actionKey}) => ({get: 0, create: 1, update: 2, destroy: 3}[actionKey])]
        ]);

        await lib.async.forEach(actions, async ({action, actionKey}) => {
          await lib.async.forEach(action, async (params, resourceKey) => {
            var mode = Array.isArray(params) ? 'many' : 'one';
            var pluralParams = mode === 'many' ? params : [params]; //always make params an array

            var resourcesData = _.filter(await lib.async.map(pluralParams, async params => {
              var hasPermission = await permissions.hasPermissionFor({
                user, resourceKey, actionKey, params, db
              });

              //TODO has permission on each include
              if (hasPermission) {
                var getResourceData;

                if (schemas[singularize(resourceKey)]) {
                  getResourceData = () => db.execute({actionKey, resourceKey, params}, {source: '/resources', logs, user, files});
                }
                else {
                  var execute = _.get(pseudoResources, `${singularize(resourceKey)}.actions.${actionKey}.execute`);

                  if (execute) {
                    getResourceData = () => execute({db});
                  }
                  else {
                    errors.push({message: `${resourceKey}.${actionKey} is an invalid request`});
                  }
                }

                if (getResourceData) {
                  try {
                    var resourceData = await getResourceData();
                  }
                  catch (error) {
                    errors.push({message: error.message});

                    if (process.env.NODE_ENV !== 'test') console.error(error);
                  }
                }
              }
              else {
                errors.push({key: 'permission-denied', message: `Permission denied for: ${actionKey} ${resourceKey}`});
              }

              return resourceData;
            }), resourceData => resourceData !== undefined);

            if (resourcesData.length > 0) {
              singularResponses.push({
                actionKey,
                resourceKey,
                resourceData: mode === 'many' ? resourcesData : resourcesData[0]
              });
            }
          });
        });
      }

      var data = {resources: {get: {}, create: {}}};

      if (!errors.length) {
        _.forEach(singularResponses, ({actionKey, resourceKey, resourceData}) => {
          if (_.includes(['get', 'create'], actionKey)) {
            data.resources[actionKey][resourceKey] = resourceData;
          }
        });
      }

      respond({response, data, errors});


      log('');
      log(chalk.inverse(` POST /resources `), chalk.inverse(` ${Date.now() - requestStartTime}ms `),
        new Date(), `userId: ${user ? user.id : '?'}`);

      if (errors.length > 0) {
        _.forEach(errors, ({message}) => log(message));
      }

      if (process.env.NODE_ENV !== 'production') {
        log(' body: ', chalk.magenta(lib.json.stringify(body.resources)));
      }

      //TODO log errors

      _.forEach(logs, ({items}) => log(...items));
    });
  }
};
