const {respond} = require('@src/lib/request');
const auth = require('@src/lib/auth/auth');

module.exports = {
  init: ({app, db}) => {
    app.post('/auth/token', async (request, response) => {
      var {email, password} = request.body;

      var user = await db.get('user', {where: {email}});

      if (user) {
        if (await auth.passwordMatches({password, user})) {
          var token = await auth.token.for({user});

          respond({response, data: {token}});
        }
        else {
          respond({response, error: {message: 'Incorrect password'}});
        }
      }
      else {
        respond({response, error: {message: `User not found`}});
      }
    });
  }
};
