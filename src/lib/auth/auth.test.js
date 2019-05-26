const auth = require('@src/lib/auth/auth');

describe('lib.auth.auth', () => {
  describe('.passwordMatches()', () => {
    it('should return true when password matches', async () => {
      var password = 'test';
      var user = {encryptedPassword: '$2a$10$.4mib8dE/ZNQRjNnACuF0OwIhIgUfUk8cB.T.G0fMEv/D6cG.v2yC'};
      var result = await auth.passwordMatches({password, user});

      expect(result).to.equal(true);
    });

    it('should return false result when password doesn\'t match', async () => {
      var password = 'tes';
      var user = {encryptedPassword: '$2a$10$.4mib8dE/ZNQRjNnACuF0OwIhIgUfUk8cB.T.G0fMEv/D6cG.v2yC'};
      var result = await auth.passwordMatches({password, user});

      expect(result).to.equal(false);
    });
  });

  describe('.token', () => {
    describe('.for(), .dataFor()', () => {
      it('should return a token', async () => {
        var token = await auth.token.for({user: {id: 1}});
        var tokenData = await auth.token.dataFor({token});

        expect(token).not.to.equal(undefined);
        expect(tokenData.user.id).to.equal(1);
      });

      it('should require a specific secret - a token with another secret should not work');

      it('should not work with an expired token');
    });

    describe('.userFor()', () => {
      it('should return a user for valid token', async () => {
        await test.db.create('user', {id: 1});

        var token = await auth.token.for({user: {id: 1}});
        var user = await auth.token.userFor({db: test.db, token});

        expect(user.id).to.equal(1);
      });

      it('should return undefined for an invalid token', async () => {
        var user = await auth.token.userFor({db: test.db, token: ''});

        expect(user).to.equal(undefined);
      });
    });
  });
});
