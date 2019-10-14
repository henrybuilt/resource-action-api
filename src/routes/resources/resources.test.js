var auth = require('../../lib/auth/auth');

describe('resources', () => {
  describe('POST to "/resources"', () => {
    var token;
    var resourcesRequest = (resources, options) => {
      return request({uri: '/resources', params: {token, resources}, ...options});
    };

    var setTokenFor = async ({group, props}) => {
      var user = await mock.userFor({group, props});

      token = await auth.token.for({user: {id: user.id}});
    };

    var setAdminToken = async () => setTokenFor({group: 'admin'});

    describe('action types', () => {
      beforeEach(setAdminToken);

      describe('get', () => {
        describe('many', () => {
          it('should return many of the requested resource', async () => {
            await test.db.create('products', [{id: 1}, {id: 2}]);

            var {body} = await resourcesRequest({get: {products: {}}});

            expect(body.success).to.equal(true);
            expect(body.data.resources.get.products.length === 2).to.equal(true);
            expect(body.data.resources.get.products[0].id).to.equal(1);
          });
        });

        describe('one', () => {
          it('should return one requested resource', async () => {
            await test.db.create('product', [{id: 2}, {id: 1}]);

            var {body} = await resourcesRequest({get: {product: {id: 1}}});

            expect(body.success).to.equal(true);
            expect(body.data.resources.get.product.id === 1).to.equal(true);
          });
        });

        describe('params (fields)', () => {
          it('should return data consist of requested fields', async () => {
            await test.db.create('product', [{id: 1, title: 'a', categoryId: 1 , rank: 1, isSellable: 1}]);

            var {body} = await resourcesRequest({get: {product: {fields: ['id', 'title', 'categoryId']}}});

            expect(body.success).to.equal(true);
            expect(_.size(body.data.resources.get.product)).to.equal(7);
            expect(body.data.resources.get.product.id).to.equal(1);
            expect(body.data.resources.get.product.title).to.equal('a');
            expect(body.data.resources.get.product.categoryId).to.equal(1);
            expect(body.data.resources.get.product.isSellable).not.to.equal(1);
          });

          it('should make sure id exists', async () => {
            await test.db.create('product', {id: 1, title: 'title'});
            var {body} = await resourcesRequest({get: {product: {fields: ['title']}}});

            expect(body.data.resources.get.product.id).to.equal(1);
          });
        });

        describe('params', () => {
          describe('where', () => {
            it('should return requested data based on requested condition', async () => {
              await test.db.create('products', [
                {id: 1, title: 'a', rank: 2},
                {id: 2, title: 'b', rank: 2},
                {id: 3, title: 'b', rank: 4},
                {id: 4, title: 'b', rank: 2}
              ]);

              var {body} = await resourcesRequest({get: {products: {where:  {title: 'b', rank: 2}}}});

              expect(body.success).to.equal(true);
              expect(body.data.resources.get.products[0].title).to.equal('b');
              expect(body.data.resources.get.products[0].rank).to.equal(2);
              expect(body.data.resources.get.products.length).to.equal(2);
            });
          });

          describe('order', () => {
            it('should return requested data in requested order', async () => {
              await test.db.create('products', [{id: 1, title: 'b'}, {id: 2, title: 'a'}, {id: 3, title: 'c'}]);

              var {body} = await resourcesRequest({get: {products: {order: ['title']}}});

              expect(body.success).to.equal(true);
              expect(_.map(body.data.resources.get.products, 'id')).to.deep.equal([2, 1, 3]);
            });
          });

          describe('fields that are named differently from columns', () => {
            it('should return the corresponding data', async () => {
              await test.db.create('products', [{id: 1, title: 'a', categoryId: 1 , rank: 2, isSellable: 3}]);

              var {body} = await resourcesRequest({get: {products: {}}});

              expect(body.success).to.equal(true);
              expect(body.data.resources.get.products[0].categoryId).to.equal(1);
              expect(body.data.resources.get.products[0].rank).to.equal(2);
              expect(body.data.resources.get.products[0].isSellable).to.equal(3);
            });
          });
        });
      });

      describe('create', () => {
        describe('many', () => {
          it('should create resources', async () => {
            var {body} = await resourcesRequest({create: {products: [{props: {id: 1}}, {props: {id: 2}}]}});
            var products = await test.db.get('products');

            expect(body.success).to.equal(true);
            expect(body.data.resources.create.products.length).to.equal(2);
            expect(_.map(body.data.resources.create.products, 'id')).to.deep.equal([1, 2]);
            expect(_.map(products, 'id')).to.deep.equal([1, 2]);
          });
        });

        describe('one', () => {
          it('should create a resource', async () => {
            var {body} = await resourcesRequest({create: {product: {props: {id: 1}}}});
            var product = await test.db.get('product', {id: 1});

            expect(body.success).to.equal(true);
            expect(product.id).to.equal(1);
            expect(body.data.resources.create.product.id).to.equal(1);
          });
        });
      });

      describe('update', () => {
        describe('many', () => {
          it('should update multiple resources with the same props', async () => {
            await test.db.create('products', [{id: 1, title: 'product'}, {id: 2, title: 'product'}]);

            var {body} = await resourcesRequest({update: {products: {where: {title: 'product'}, props: {title: 'renamed'}}}});
            var products = await test.db.get('products', {order: ['id']});

            expect(body.success).to.equal(true);
            expect(_.map(products, 'title')).to.deep.equal(['renamed', 'renamed']);
          });

          it('should update multiple resources with different props', async () => {
            await test.db.create('products', [{id: 1, title: 'a'}, {id: 2, title: 'b'}, {id: 3, title: 'b'}]);

            var {body} = await resourcesRequest({update: {products: [
              {where: {title: 'a'}, props: {title: 'A'}},
              {where: {title: 'b'}, props: {title: 'B'}}
            ]}});

            var products = await test.db.get('products', {order: ['id']});

            expect(body.success).to.equal(true);
            expect(_.map(products, 'title')).to.deep.equal(['A', 'B', 'B']);
          });
        });

        describe('one', () => {
          it('should update one resource', async () => {
            await test.db.create('product', [{id: 1, title: 'product'}]);

            var {body} = await resourcesRequest({update: {product: {where: {title: 'product'}, props: {title: 'renamed'}}}});
            var product = await test.db.get('product', {id: 1});

            expect(body.success).to.equal(true);
            expect(product.title).to.equal('renamed');
          });

          it('should update a resource with multiple props', async () => {
            await test.db.create('product', [{id: 1, title: 'a', rank: 1}]);

            var {body} = await resourcesRequest({update: {product: [{where: {id: 1}, props: {title: 'A', rank: 2}}]}});
            var product = await test.db.get('product', {id: 1});

            expect(body.success).to.equal(true);
            expect(product.title).to.equal('A');
            expect(product.rank).to.equal(2);
          });
        });
      });

      describe('destroy', () => {
        describe('many', () => {
          it('should destroy more than one resources with one where condition', async () => {
            await test.db.create('products', [{id: 1, title: 'a'}, {id: 2, title: 'b'}, {id: 3, title: 'a'}]);

            var {body} = await resourcesRequest({destroy: {products: {where: {title: 'a'}}}});
            var products = await test.db.get('products', {where: {deleted: 1}});

            expect(body.success).to.equal(true);
            expect(products.length).to.equal(2);
          });

          it('should destroy more than one resources with more than one where condition ', async () => {
            await test.db.create('products', [{id: 1, title: 'a', rank: 1}, {id: 2, title: 'b', rank: 2}, {id: 3, title: 'a', rank: 3}]);

            var {body} = await resourcesRequest({destroy: {products: {where: {title: 'a', rank: 3}}}});
            var products = await test.db.get('products', {where: {deleted: 1}});

            expect(body.success).to.equal(true);
            expect(products.length).to.equal(1);
          });
        });

        describe('one', () => {
          it('should destroy only the given resource', async () => {
            await test.db.create('product', [{id: 1, title: 'a', rank: 1}, {id: 2, title: 'b', rank: 2}]);

            var {body} = await resourcesRequest({destroy: {product: {where: {id: 1}}}});
            var product = await test.db.get('product', {where: {deleted: 1}});

            expect(body.success).to.equal(true);
            expect(product.title).to.equal('a');
          });
        });

        describe('when destroying all (where is empty/nonexistant)', () => {
          it('should respond with an error when destroyAll flag is not passed', async () => {
            await test.db.create('products', [{id: 1, title: 'a', rank: 1}, {id: 2, title: 'b', rank: 2}]);

            var {body} = await resourcesRequest({destroy: {products: {}}});
            var products = await test.db.get('products', {where: {deleted: 0}});

            expect(body.success).to.equal(false);
            expect(body.errors[0].message).to.equal('Delete all failed');
            expect(_.map(products, 'id')).to.deep.equal([1, 2]);
          });

          it('should respond with an error when destroyAll flag is passed', async () => {
            await test.db.create('product', [{id: 1, title: 'a', rank: 1}, {id: 2, title: 'b', rank: 2}]);

            var {body} = await resourcesRequest({destroy: {product: {destroyAll: true}}});
            var products = await test.db.get('products', {where: {deleted: 1}});

            expect(body.success).to.equal(true);
            expect(_.map(products, 'id')).to.deep.equal([1, 2]);
          });
        });
      });
    });

    describe('pseudo resources', () => {
      beforeEach(setAdminToken);

      describe('get many', () => {
        it('should behave as if the resource were a real resource in the database', async () => {
          await test.db.create('topLevelProductCategory', {id: 1, title: 'kitchen'});
          await test.db.create('topLevelProductCategory', {id: 2, title: 'vanity'});
          await test.db.create('middleLevelProductCategory', {id: 1, title: 'base', parentCategoryId: 1 });
          await test.db.create('middleLevelProductCategory', {id: 2, title: 'base', parentCategoryId: 2 });
          await test.db.create('bottomLevelProductCategory', {id: 1, title: 'drawer', parentCategoryId: 1});
          await test.db.create('bottomLevelProductCategory', {id: 2, title: 'drawer', parentCategoryId: 2});

          var {body} = await resourcesRequest({get: {productCategories: {}}});

          expect(body.success).to.equal(true);
          expect(body.data.resources.get.productCategories.length).to.equal(2);
          expect(body.data.resources.get.productCategories.length).to.equal(2);
        });
      });

    });

    describe('non-existant resource', () => {
      beforeEach(setAdminToken);

      it('should gracefully respond with an error message', async () => {
        var {body} = await resourcesRequest({get: {asdf: {}}});

        expect(body.success).to.equal(false);
        expect(body.errors[0].message).to.equal('Resource asdf does not exist');
      });
    });

    describe('permissions', () => {
      describe('groups', () => {
        var createUserFor = async ({group}) => {
          var user = await mock.userFor({group});

          token = await auth.token.for({user: {id: user.id}});

          return user;
        };

        var requestResourceUpdateTitleFor = async ({resourceKey}) => {
          await test.db.create(resourceKey, {id: 1, title: 'initial name'});

          var {body} = await resourcesRequest({update: {[resourceKey]: {where: {id: 1}, props: {title: 'renamed'}}}});
          var resource = await test.db.get(resourceKey, {id: 1});

          return {body, resource};
        };

        describe('anyone', () => {
          it('should receive no data', async () => {
            token = '';

            var {body, resource} = await requestResourceUpdateTitleFor({resourceKey: 'product'});

            expect(body.success).to.equal(false);
            expect(body.errors[0].message).to.equal('Permission denied for: update product');
            expect(resource.title).not.to.equal('renamed');
          });
        });

        describe('user', () => {
          var user;

          beforeEach(async () => user = await createUserFor({group: 'user'}));

          it('should not be able to access an employee scope resource', async () => {
            var {body} = await requestResourceUpdateTitleFor({resourceKey: 'project'});

            expect(body.success).to.equal(false);
            expect(body.errors[0].message).to.equal('Permission denied for: update project');
          });

          //WARNING test converage for these functions should be implemented in schemas
          //WARNING these tests simply verify those functions are being called and respected
          // describe('userHasPermissionFor', () => {
          //   describe('general - via productIstances', () => {
          //     var createValidCollection = async () => {
          //       await test.db.create('scopes', [
          //         {id: 1, versionId: 1, projectId: 1},
          //         {id: 2, versionId: 2, projectId: 2}
          //       ]);
          //
          //       await test.db.create('productInstances', [
          //         {id: 1, scopeId: 1, projectId: 1},
          //         {id: 2, scopeId: 2, projectId: 2}
          //       ]);
          //     };
          //
          //     var createMixedCollection = async () => {
          //       await test.db.create('scopes', [
          //         {id: 1, versionId: 1, projectId: 1},
          //         {id: 2, versionId: 3, projectId: 3}
          //       ]);
          //
          //       await test.db.create('productInstances', [
          //         {id: 1, scopeId: 1, projectId: 1},
          //         {id: 2, scopeId: 2, projectId: 3}
          //       ]);
          //     };
          //
          //     beforeEach(async () => {
          //       await test.db.create('projects', [
          //         {id: 1, userId: user.id}, {id: 2, userId: user.id}, {id: 3}]);
          //       await test.db.create('projectVersions', [
          //         {id: 1, projectId: 1}, {id: 2, projectId: 2}, {id: 3, projectId: 3}]);
          //     });
          //
          //     it('should be able to update productInstances associated with an owned project', async () => {
          //       await createValidCollection();
          //
          //       var {body} = await resourcesRequest({
          //         update: {productInstances: {where: {id: [1, 2]}, props: {quantity: 3}}}
          //       });
          //
          //       var resources = await test.db.get('productInstances', {where: {id: [1, 2]}});
          //
          //       expect(body.success).to.equal(true);
          //       expect(_.map(resources, 'quantity')).to.deep.equal([3, 3]);
          //     });
          //
          //     it('should not be able to update productInstances associated with an unowned project', async () => {
          //       await createMixedCollection();
          //
          //       var {body} = await resourcesRequest({
          //         update: {productInstances: {where: {id: [1, 2]}, props: {quantity: 3}}}
          //       });
          //
          //       var resources = await test.db.get('productInstances', {where: {id: [1, 2]}});
          //
          //       expect(body.success).to.equal(false);
          //       expect(_.map(resources, 'quantity')).to.deep.equal([undefined, undefined]);
          //     });
          //
          //     it('should be able to update owned, but not unowned project', async () => {
          //       await createMixedCollection();
          //
          //       var {body} = await resourcesRequest({
          //         update: {project: {where: {id: 1}, props: {title: 'test'}}}
          //       });
          //
          //       var project = await test.db.get('project', {where: {id: 1}});
          //
          //       expect(body.success).to.equal(true);
          //       expect(project.title).to.equal('test');
          //
          //       var {body} = await resourcesRequest({
          //         update: {project: {where: {id: 3}, props: {title: 'test'}}}
          //       });
          //
          //       var project = await test.db.get('project', {where: {id: 3}});
          //
          //       expect(body.success).to.equal(false);
          //       expect(project.title).to.equal('');
          //     });
          //
          //     it('should be able to get a valid project tree, but not an invalid one', async () => {
          //       await createMixedCollection();
          //
          //       var {body} = await resourcesRequest({
          //         get: {projects: {where: {id: 1}, include: {
          //           projectVersions: {}, scopes: {}, productInstances: {}
          //         }}}
          //       });
          //
          //       expect(body.success).to.equal(true);
          //
          //       var {body} = await resourcesRequest({
          //         get: {projects: {where: {id: 3}, include: {
          //           projectVersions: {}, scopes: {}, productInstances: {}
          //         }}}
          //       });
          //
          //       expect(body.success).to.equal(false);
          //     });
          //
          //     //TODO not sure this is possible to reproduce
          //     //TODO will consider when the situation arises
          //     it('should not be able to get unowned instance via include on another resource', async () => {
          //       await createMixedCollection();
          //
          //       var {body} = await resourcesRequest({
          //         get: {projects: {
          //           where: {id: 1}, include: {projectVersions: {where: {projectId: 3}}}
          //         }}
          //       });
          //
          //       var {projectVersions} = body.data.resources.get.projects[0];
          //
          //       expect(body.success).to.equal(true);
          //       expect(_.map(projectVersions, 'projectId')).to.deep.equal([1, 1]);
          //     });
          //   });
          //
          //   describe('project resources', () => {
          //     var projectResourceKeys = [
          //       'floor',
          //       'room',
          //       'wall',
          //       'archElementInstance',
          //       'scope',
          //       'containerInstance',
          //       'productInstance',
          //       'partInstance',
          //       'kitInstance'
          //     ];
          //
          //     var schemaFor = ({resourceKey: r}) => require(`@src/schemas/${_.kebabCase(r)}`);
          //
          //     it('should only give permission for resources with owned project', async () => {
          //       var confirmPermissions = async owned => {
          //         var project = await test.db.create('project', owned ? {userId: user.id} : {}, {useMiddleware: false});
          //         var version = await test.db.create('projectVersion', {projectId: project.id});
          //         var scope = await test.db.create('scope', {versionId: version.id});
          //
          //         var resources = {project, projectVersion: version, scope};
          //
          //         await lib.async.forEach(projectResourceKeys, async resourceKey => {
          //           var schema = schemaFor({resourceKey});
          //
          //           var parentForeignKey = _.keys(schema.permissionsData.hasPermissionByPropKey)[0];
          //           var parentResourceKey = schema.permissionsData.resourcePathToUserId[0];
          //
          //           var props = {[parentForeignKey]: resources[parentResourceKey].id};
          //
          //           var {body} = await resourcesRequest({create: {[resourceKey]: {props}}}, {userId: 1});
          //
          //           expect(body.success).to.equal(owned);
          //         });
          //       };
          //
          //       await confirmPermissions(true);
          //       await confirmPermissions(false);
          //     });
          //   });
          // });
        });

        describe('employee', () => {
          beforeEach(async () => await createUserFor({group: 'employee'}));

          it('should should be able to access permitted resources', async () => {
            var {body, resource} = await requestResourceUpdateTitleFor({resourceKey: 'project'});

            expect(body.success).to.equal(true);
            expect(resource.title).to.equal('renamed');
          });

          it('should not be able to access a non-employee permitted resource', async () => {
            var {body, resource} = await requestResourceUpdateTitleFor({resourceKey: 'product'});

            expect(body.success).to.equal(false);
            expect(resource.title).not.to.equal('renamed');
          });
        });

        describe('admin', () => {
          it('should be able to access and modify the resources', async () => {
            createUserFor({group: 'admin'});

            var {body, resource} = await requestResourceUpdateTitleFor({resourceKey: 'product'});

            expect(body.success).to.equal(true);
            expect(resource.title).to.equal('renamed');
          });
        });

        describe('user with permission from database', () => {
          it('should ');
        });
      });

      describe('includes', () => {
        it('should not permit access to included unpermitted resources'); //product user
      });

      describe('ownershipRequired', () => {
        it('should');
      });

      describe('actions', () => {
        it('should');
      });
    });
  });
});
