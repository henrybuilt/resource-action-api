var {respond} = require('@src/lib/request');
var chalk = require('chalk');

//HINT helper function to make adding routes more generic
//WARNING requires a session by default, but can be disabled with third options argument
//HINT post('/path/to/route', async ({user, body, throwError}) => <optional data to respond with>)
module.exports = ({app, db, auth}) => function(path, callback, {requireUser=true}={}) {
  app.post(path, async (request, response) => {
    var user, {token} = request.body;
    var {NODE_ENV} = process.env;

    if (NODE_ENV !== 'test') {
      if (NODE_ENV !== 'production') console.log('');

      var message = chalk.inverse(` POST ${path} `);

      if (NODE_ENV !== 'production') message += ' ' + chalk.magenta(lib.json.stringify(_.omit(request.body, ['token'])))

      console.log(message);
    }

    if (token) {
      user = await auth.token.userFor({db, token});
    }

    var errorData, throwError = (_errorData) => {
      errorData = _errorData;

      throw new Error();
    }

    try {
      if (requireUser && !(user && user.id)) throwError({message: 'Something went wrong #100', key: 'userRequired'});

      var data = await callback({...request.body, user, body: request.body, throwError});

      data ? respond({response, data}) : respond({response});
    }
    catch (error) {
      if (errorData) {
        if (process.env.NODE_ENV !== 'test') console.error(errorData);
      }
      else {
        console.error(error);
      }

      respond({response, error: errorData});
    }
  });
};
