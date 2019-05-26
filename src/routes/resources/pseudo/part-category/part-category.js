var partCategories = {
  actions: {
    get: {
      execute: async ({db}) => {
        var allCategories = await db.get('allPartCategories', {fields: ['id', 'title', 'parentCategoryId']});

        var bottomLevelCategories = _.reject(allCategories, {parentCategoryId: -1});

        _.forEach(bottomLevelCategories, bottomLevelCategory => {
          var topLevelCategory = _.find(allCategories, {id: bottomLevelCategory.parentCategoryId});

          if (bottomLevelCategory.id !== -1) {
            bottomLevelCategory.title = `${topLevelCategory.title} > ${bottomLevelCategory.title}`;
          }
        });

        return bottomLevelCategories;
      }
    }
  }
};

module.exports = partCategories;
