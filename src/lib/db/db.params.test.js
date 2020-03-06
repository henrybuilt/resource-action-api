describe('db', () => {
  describe('params', () => {
    describe('page',  () => {
      it('should properly page the result', async () => {
        await test.db.create('products', [{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}, {id: 6}]);

        var products1 = await test.db.get('products', {page: {number: 1, count: 2}});
        var products2 = await test.db.get('products', {page: {number: 2, count: 2}});
        var products3 = await test.db.get('products', {page: {number: 1, count: 4}});
        var products4 = await test.db.get('products', {page: {number: 4, count: 1}});

        expect(_.map(products1, 'id')).to.deep.equal([1, 2]);
        expect(_.map(products2, 'id')).to.deep.equal([3, 4]);
        expect(_.map(products3, 'id')).to.deep.equal([1, 2, 3, 4]);
        expect(_.map(products4, 'id')).to.deep.equal([4]);
      });
    });

    describe('limit', () => {
      it('should limit result count', async () => {
        await test.db.create('products', [{id: 1}, {id: 2}, {id: 3}]);

        var products = await test.db.get('products', {limit: 2});

        expect(_.map(products, 'id')).to.deep.equal([1, 2]);
      });
    });

    describe('order', () => {
      describe('with string', () => {
        it('should properly order results in ascending order', async () => {
          await test.db.create('products', [{id: 3}, {id: 1}, {id:2}]);
          var products = await test.db.execute({actionKey: 'get', resourceKey: 'products', params: {order: ['id']}});

          expect(products[0].id).to.equal(1);
        });
      });

      describe('with object', () => {
        it('should properly order results with respect to direction', async () => {
          await test.db.create('products', [{id: 3}, {id: 1}, {id:2}]);
          var products = await test.db.execute({actionKey: 'get', resourceKey: 'products', params: {order: [{field: 'id', direction: 'desc'}]}});

          expect(products[0].id).to.equal(3);
        });
      });
    });

    describe('where', () => {
      describe('with array', () => {
        it('should use WHERE IN query', async () => {
          await test.db.create('products', [{id: 1}, {id: 2}, {id: 3}]);

          var products = await test.db.execute({actionKey: 'get', resourceKey: 'products', params: {where: {id: [1, 3]}}});

          expect(products.length).to.equal(2);
        });
      });

      // TODO
      // describe('is not null', () => {
      //   it('should use WHERE IN query', async () => {
      //     await test.db.create('products', [{id: 1}, {id: 2}, {id: 3}]);
      //
      //     var products = await test.db.execute({actionKey: 'get', resourceKey: 'products', params: {where: {id: [1, 3]}}});
      //
      //     expect(products.length).to.equal(2);
      //   });
      // });

      describe('field is empty', () => {
        it('should not consider where condition', async () => {
          await test.db.create('products', [{id: 1}, {id: 2}]);

          var products = await test.db.execute({actionKey: 'get', resourceKey: 'products', params: {where: {id: []}}});

          expect(products.length).to.equal(0);
        });
      });

      describe('deleted', () => {
        it('should filter out deleted resources by default', async () => {
          await test.db.create('products', [{id: 1}, {id: 2, deleted: 1}]);

          var products = await test.db.get('products');

          expect(_.map(products, 'id')).to.deep.equal([1]);

          var products = await test.db.get('products', {where: {deleted: 1}});

          expect(_.map(products, 'id')).to.deep.equal([2]);
        });
      });

      describe('include', () => {
        describe('using simple primary/foreign keys', () => {
          var productId;

          beforeEach(async () => {
            var id1 = 1, id2 = 2, id3 = 3, id4 = 4;

            await test.db.create('bottomLevelProductCategories', [
              {id: id2, title: 'asdf'},
              {id: id1, title: 'category'},
              {id: id3, title: 'fdsa'}
            ]);

            await test.db.create('bottomLevelProductCategoryVersions', [
              {id: id1, productCategoryId: id1},
              {id: id2, productCategoryId: id1},
              {id: id3, productCategoryId: id2}
            ]);

            var products = await test.db.create('products', [
              {id: id1, categoryId: id1, title: 'product1'},
              {id: id2, categoryId: id2, title: 'product2'},
              {id: id3, categoryId: id2, title: 'product3'}
            ]);

            productId = products[0].id;

            await test.db.create('productVersions', [
              {id: id1, productId: id1},
              {id: id2, productId: id1},
              {id: id3, productId: id2},
              {id: id4, productId: id3}
            ]);
          });

          it('should include direct children of the requested resource', async () => {
            var product = await test.db.get('product', {where: {id: productId}, include: {bottomLevelProductCategory: {}}});

            expect(product.title).to.equal('product1');
            expect(product.bottomLevelProductCategory.title).to.equal('category');
          });

          it('should respect {last: true}', async () => {
            var product = await test.db.get('product', {where: {id: productId}, include: {productVersion: {}}});

            expect(product.title).to.equal('product1');
            expect(product.productVersion.id).to.equal(2);
          });

          it('should include indirect children of the requested resource', async () => {
            var product = await test.db.get('product', {where: {id: productId}, include: {
              bottomLevelProductCategory: {},
              bottomLevelProductCategoryVersion: {}
            }});

            expect(product.title).to.equal('product1');
            expect(product.bottomLevelProductCategory.title).to.equal('category');
            expect(product.bottomLevelProductCategory.bottomLevelProductCategoryVersion.id).to.equal(2);
          });

          it('should work with request for many resources', async () => {
            var products = await test.db.get('products', {include: {
              bottomLevelProductCategory: {}, bottomLevelProductCategoryVersion: {}, productVersion: {}
            }}, {useMiddleware: false});

            expect(products.length).to.equal(3);
            expect(products[1].bottomLevelProductCategory.bottomLevelProductCategoryVersion.id).to.equal(3);
            expect(products[2].productVersion.id).to.equal(4);
          });

          it('should work with arrays', async () => {
            var products = await test.db.get('products', {include: [
              {bottomLevelProductCategory: {}},
              'bottomLevelProductCategoryVersion'
            ]}, {useMiddleware: false});

            expect(products.length).to.equal(3);
            expect(products[1].bottomLevelProductCategory.bottomLevelProductCategoryVersion.id).to.equal(3);
          });
        });

        describe('using associations', () => {
          beforeEach(async () => mock.productsWithCategories({quantity: 3}));

          it('should correctly find associated items with a simple relationship', async () => {
            await test.db.create('media', [
              {id: 1, associations: {products: {id_1: 1}}},
              {id: 2, associations: {products: {id_1: 1}}},
              {id: 3, associations: {products: {id_2: 1}}}
            ]);

            var [product1, product2] = await test.db.get('products', {
              where: {id: [1, 2]}, include: {media: {}, documents: {}}
            });

            expect(product1.title).to.equal('product1');
            expect(product2.title).to.equal('product2');
            expect(_.map(product1.media, 'id')).to.deep.equal([1, 2]);
            expect(_.map(product2.media, 'id')).to.deep.equal([3]);
          });

          it('should correctly find associated items with a nested relationship', async () => {
            await test.db.create('documents', [
              {id: 1, associations: {products: {id_1: 1}}},
              {id: 2, associations: {product_categories_b: {id_1: 1}}},
              {id: 3, associations: {products: {id_2: 1}}}
            ]);

            var [product1, product2] = await test.db.get('products', {where: {id: [1, 2]}, include: {documents: {}}});

            expect(_.map(product1.documents, 'id')).to.deep.equal([1, 2]);
            expect(_.map(product2.documents, 'id')).to.deep.equal([3]);
          });
        });
      });
    });

    it('should prevent bad fields values from making it to the database', async () => {
      await test.db.create('products', {'DROP TABLE pt_products': 1, id: 1});
      await test.db.get('products', {where: {id: 1}, fields: ['DROP TABLE pt_products']});

      var products = await test.db.get('products', {where: {id: 1}});

      expect(products.length).to.equal(1);
    });

    describe('complex where conditions', () => {
      describe('or', () => {
        it('');
      });

      describe('or inside and', () => {
        it('');
      });

      describe('or inside and using middleware', () => {
        it('');
      });
    });

    // it('should work properly with "OR" condition in WHERE clause', async () => {
    //   await test.db.create('products', [{id: 1, title: 'product1'}, {id: 2, title: 'product2'}, {id:3, title: 'product3'}]);
    //   var products = await test.db.execute({actionKey: 'get', resourceKey: 'products', params: {where: []}});
    //
    //   expect(products.length).to.equal(2);
    //   expect(products[0].title).to.deep.equal('product2');
    //   expect(products[1].title).to.deep.equal('product3');
    // });
  });
});
