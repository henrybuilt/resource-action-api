var {singularize} = require('inflection');

var middlewareRunner = {
  helpersFor({...props}) {
    return {
      shouldInclude: (resourceKey) => {
        var shouldInclude = false;
        var include = _.get(props, 'originalParams.include', {});

        if (Array.isArray(include)) {
          shouldInclude = _.some(include, (includedResource) => {
            return !!includedResource[resourceKey] || includedResource === resourceKey;
          });
        }
        else {
          shouldInclude = include[resourceKey] !== undefined;
        }

        return shouldInclude;
      },
      useField: (fieldKey, {usually=false} = {}) => {
        var fields = _.get(props, 'originalParams.fields', []);
        var useField = _.includes(fields, fieldKey);

        if (usually) useField = useField || props.originalParams.fields === undefined;

        return useField;
      },
      forEachResource: (fn) => {
        _.forEach(props.queryData.resources, fn);
      }
    };
  },

  async run({resourceKey, actionKey, onKey, middleware: allMiddlewares, ...args}) {
    var helpers = middlewareRunner.helpersFor(args);
    var middlewares = allMiddlewares[singularize(resourceKey)];
  
    middlewares = _.filter(middlewares, ({on, actions}) => {
      return _.includes(on, onKey) && _.includes(actions, actionKey);
    });

    await lib.async.forEach(middlewares, async middleware => {
      if (!middleware.shouldExecute || middleware.shouldExecute(args)) {
        middleware.execute({actionKey, ...args, ...helpers});
      }
    });
  }
};

module.exports = middlewareRunner;
