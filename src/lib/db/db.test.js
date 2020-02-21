describe('db', () => {
  describe('action helpers', () => {
    describe('update', () => {
      describe('one', () => {
        it('should properly update a single resource', async() => {
          var product = await test.db.create('product', {});

          await test.db.update('product', {where: {id: product.id}, props: {title: 'asdf'}});

          product = await test.db.get('product', {where: {id: product.id}});

          expect(product.title).to.equal('asdf');
        });
      });
    });
  });

  describe('middleware', () => {
    it('should use the middleware based on needed resourceKey', async () => {
      await test.db.create('medium', {id: 1, associations: {products: {id_1: 1}}});
      await test.db.create('medium', {id: 2, associations: {products: {id_1: 1}}});
      await test.db.create('medium', {id: 3, associations: {products: {id_2: 1}}});

      var media = await test.db.get('media', {where: {productId: 1}});

      expect(media.length).to.equal(2);
      expect(_.map(media, 'id')).to.deep.equal([1,2]);
    });
  });

  describe('filterByAssociations', () => {
    var filterByAssociations = async ({originalParams, queryData, resourceKey}) => {
      var executor = new test.db.Executor({params: originalParams, resourceKey});

      executor.queryData = queryData;

      return executor.filterByAssociations();
    };

    describe('medium', () => {
      describe('productId', () => {
        it('should properly modify queryData with an individual where clause', async () => {
          var queryData = {whereSqlStrings: [], args: []};

          await filterByAssociations({originalParams: {where: {productId: 1}}, queryData, resourceKey: 'medium'});

          //HINT basically associations.products.id_1 === 1
          expect(queryData.whereSqlStrings).to.deep.equal(['(JSON_EXTRACT(associations, ?) IS NOT NULL)']);
          expect(queryData.args).to.deep.equal([`$.products.id_1`]);
        });
      });

      describe('productId and materialId', () => {
        it('should properly modify queryData with multiple where clauses', async () => {
          var queryData = {whereSqlStrings: [], args: []};

          await filterByAssociations({originalParams: {where: {materialId: 1, productId: [1, 2]}}, queryData, resourceKey: 'medium'});

          expect(queryData.whereSqlStrings).to.deep.equal([
            '(JSON_EXTRACT(associations, ?) IS NOT NULL OR JSON_EXTRACT(associations, ?) IS NOT NULL)',
            '(JSON_EXTRACT(associations, ?) IS NOT NULL)'
          ]);
          expect(queryData.args).to.deep.equal([`$.products.id_1`, `$.products.id_2`, `$.materials.id_1`]);
        });
      });
    });

    describe('document', () => {
      beforeEach(async () => mock.productsWithCategories({quantity: 2}));

      describe('componentId', () => {
        it('should properly modify queryData with an individual where clause', async () => {
          var queryData = {whereSqlStrings: [], args: []};

          await filterByAssociations({originalParams: {where: {componentId: 1}}, queryData, resourceKey: 'document'});

          expect(queryData.whereSqlStrings).to.deep.equal(['(JSON_EXTRACT(subjects, ?) IS NOT NULL)']);
          expect(queryData.args).to.deep.equal([`$.components.id_1`]);
        });
      });

      describe('productId and componentId', () => {
        it('should properly modify queryData with multiple where clauses and productId', async () => {
          var queryData = {whereSqlStrings: [], args: []};

          await filterByAssociations(
            {originalParams: {where: {componentId: 1, productId: [1, 2]}}, queryData, resourceKey: 'document'}
          );

          expect(queryData.args).to.deep.equal([
            `$.products.id_1`,
            `$.products.id_2`,
            `$.components.id_1`,
          ]);
          expect(queryData.whereSqlStrings).to.deep.equal([
            '(JSON_EXTRACT(subjects, ?) IS NOT NULL OR JSON_EXTRACT(subjects, ?) IS NOT NULL)',
            '(JSON_EXTRACT(subjects, ?) IS NOT NULL)',
          ]);
        });
      });
    });
  });

  describe('validation', () => {
    beforeEach(async () => await test.db.create('product', {id: 1}));

    it('should throw an error on bad resourceKey', async () => {
      var error;

      try {
        await test.db.get('asdf', {where: {id: 1}});
      }
      catch (e) {
        error = e;
      }

      expect(error.message).to.equal('Invalid resourceKey');
    });

    it('should prevent bad fields values from making it to the database', async () => {
      await test.db.get('products', {where: {id: 1}, fields: ['DROP TABLE pt_products']});

      var products = await test.db.get('products', {where: {id: 1}});

      expect(products.length).to.equal(1);
    });
  });
});
