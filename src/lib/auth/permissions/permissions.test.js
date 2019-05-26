var permissions = require('./permissions');

describe('lib.auth.permissions', () => {
  describe('.hasPermissionFor()', () => {
    describe('user.permissions - with resource "someResource"', () => {
      describe('null', () => {
        it('should not give permission', async () => {
          var hasPermission = await permissions.hasPermissionFor({
            user: {permissions: null}, resourceKey: 'someResource', actionKey: 'get'
          });

          expect(hasPermission).to.equal(false);
        });
      });

      describe('{}', () => {
        it('should not give permission', async () => {
          var hasPermission = await permissions.hasPermissionFor({
            user: {permissions: {}}, resourceKey: 'someResource', actionKey: 'get'
          });

          expect(hasPermission).to.equal(false);
        });
      });

      describe(`{admin: '*'}`, () => {
        it('should give permission', async () => {
          var hasPermission = await permissions.hasPermissionFor({
            user: {permissions: {admin: '*'}}, resourceKey: 'someOtherResource', actionKey: 'get'
          });

          expect(hasPermission).to.equal(true);
        });
      });

      describe(`{admin: {some_resource: '*'}}`, () => {
        it('should give permission', async () => {
          var {id} = await test.db.create('user', {permissions: {admin: {parts: '*', some_resource2: '*'}}});
          var user = await test.db.get('user', {where: {id}});

          var hasPermission = await permissions.hasPermissionFor({
            user, resourceKey: 'part', actionKey: 'create'
          });

          expect(hasPermission).to.equal(true);
        });
      });

      describe(`some other resource`, () => {
        it('should not give permission', async () => {
          var hasPermission = await permissions.hasPermissionFor({
            user: {permissions: {admin: {some_resource: '*'}}}, resourceKey: 'someOtherResource', actionKey: 'get'
          });

          expect(hasPermission).to.equal(false);
        });
      });
    });

    describe('should give permission', () => {
      it('to admin regardless of resource', async () => {
        var hasPermission = await permissions.hasPermissionFor({user: {admin: 1}});

        expect(hasPermission).to.equal(true);
      });

      it('to employee for permitted resource', async () => {
        var hasPermission = await permissions.hasPermissionFor({user: {level: 2}, resourceKey: 'project'});

        expect(hasPermission).to.equal(true);
      });

      it('to employee for permitted actions', async () => {
        var hasPermission = await permissions.hasPermissionFor({user: {level: 2}, resourceKey: 'products', actionKey: 'get'});

        expect(hasPermission).to.equal(true);
      });
    });

    describe('should not give permission', () => {
      it('to user ever', async () => {
        var hasPermission = await permissions.hasPermissionFor({user: {level: 1}, resourceKey: 'products', actionKey: 'get'});

        expect(hasPermission).to.equal(false);
      });

      it('to employee for unpermitted resource', async () => {
        var hasPermission = await permissions.hasPermissionFor({user: {level: 2}, resourceKey: 'products'});

        expect(hasPermission).to.equal(false);
      });

      it('to employee for unpermitted actions', async () => {
        var hasPermission = await permissions.hasPermissionFor({user: {level: 2}, resourceKey: 'products', actionKey: 'update'});

        expect(hasPermission).to.equal(false);
      });
    });
  });
});
