const {respond} = require('../../lib/request');
const auth = require('../../lib/auth/auth');

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

    //HINT dev-only: mint a token without a password so local editor/portal sessions load without a
    //login (same as viewing H/portal pages logged-out). The NODE_ENV gate means this route is never
    //registered in production. Picks the user by ?email=, else DEV_USER_EMAIL.
    if (process.env.NODE_ENV !== 'production') {
      app.get('/auth/dev-token', async (request, response) => {
        var email = request.query.email || process.env.DEV_USER_EMAIL;

        if (!email) {
          respond({response, error: {message: 'Set DEV_USER_EMAIL or pass ?email= to mint a dev token'}});

          return;
        }

        var user = await db.get('user', {where: {email}});

        if (user) {
          var token = await auth.token.for({user});

          respond({response, data: {token, userId: user.id, email: user.email}});
        }
        else {
          respond({response, error: {message: `Dev user not found: ${email}`}});
        }
      });
    }
  }
};
