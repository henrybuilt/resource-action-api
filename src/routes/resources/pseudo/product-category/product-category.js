var productCategories = {
  actions: {
    get: {
      execute: async ({db}) => {
        var categories = {
          top: await db.get('topLevelProductCategories', {fields: ['id', 'title', 'rank']}),
          middle: await db.get('middleLevelProductCategories', {fields: ['id', 'parentCategoryId', 'title', 'rank', 'abbreviation']}),
          bottom: await db.get('bottomLevelProductCategories', {fields: ['id', 'parentCategoryId', 'title', 'rank']})
        };

        var productCategories =_.map(categories.bottom, bottomCategory => {
          var category = {};

          category.bottom = bottomCategory;
          category.middle = _.find(categories.middle, {id: category.bottom.parentCategoryId});
          category.top = _.find(categories.top, {id: category.middle.parentCategoryId});

          return {
            id: category.bottom.id,
            title: _.join(_.filter(_.map([category.top, category.middle, category.bottom], 'title'), title => title !== ''), ' > '),
            abbreviation: category.middle.abbreviation,
            ranks: _.mapValues(category, 'rank')
          };
        });

        productCategories = _.sortBy(productCategories, ['ranks.top', 'ranks.middle', 'ranks.bottom']);
        productCategories = _.map(productCategories, ({title, id, abbreviation}) => ({title, id, abbreviation}));

        return productCategories;
      }
    }
  }
};

module.exports = productCategories;
