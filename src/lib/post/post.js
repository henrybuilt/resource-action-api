var {respond} = require('../request.js');
var chalk = require('chalk');

//HINT helper function to make adding routes more generic
//WARNING requires a session by default, but can be disabled with third options argument
//HINT post('/path/to/route', async ({user, body, throwError}) => <optional data to respond with>)
module.exports = ({app, db, auth}) => function(path, callback, {requireUser=true, shouldLog=true}={}) {
  app.post(path, async (request, response) => {
    var user, {token} = request.body;
    var {NODE_ENV} = process.env;

    if (NODE_ENV !== 'test' && shouldLog) {
      if (NODE_ENV !== 'production') console.log('');

      var message = chalk.inverse(` POST ${path} `);

      if (NODE_ENV !== 'production') message += ' ' + chalk.magenta(lib.json.stringify(_.omit(request.body, ['token'])))

      console.log(message);
    }

    if (token) {
      try {
        user = await auth.token.userFor({db, token}, {shouldLog});
      }
      catch (error) {
        console.log(error);
      }
    }

    var errorData, throwError = (_errorData) => {
      errorData = _errorData;

      throw new Error();
    }

    try {
      if (requireUser && !(user && user.id !== undefined)) throwError({message: 'Your session is invalid or has expired. Please try logging in again.', key: 'userRequired'});

      var data = await callback({...request.body, user, body: request.body, throwError, response, request});

      data ? respond({response, data}) : respond({response});
    }
    catch (error) {
      if (error.data) errorData = error.data;

      if (errorData) {
        if (process.env.NODE_ENV !== 'test') console.error(errorData);
      }
      else {
        console.error(error);
      }

      respond({response, error: errorData || {message: 'Something went wrong', error}});
    }
  });
};
