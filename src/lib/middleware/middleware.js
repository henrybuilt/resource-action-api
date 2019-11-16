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
  async run({resourceKey, actionKey, onKey, middleware: allMiddlewares, ...props}) {
    try {
      var helpers = middlewareRunner.helpersFor(props);

      var middlewares = _.filter(allMiddlewares[singularize(resourceKey)], ({on, actions}) => {
        return _.includes(on, onKey) && _.includes(actions, actionKey);
      });

      await lib.async.forEach(middlewares, middleware => middleware.execute({actionKey, ...props, ...helpers}));
    }
    catch (error) {
      //istanbul ignore if
      if (!_.includes(error.message, 'Cannot find module')) alwaysLog(error);
    }
  }
};

module.exports = middlewareRunner;
