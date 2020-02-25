var {singularize, pluralize} = require('inflection');
var moment = require('moment');
var middlewareRunner = require('../middleware/middleware');

module.exports = ({db, dbConfig, schemas, relationships, middleware, permissions}) => {
  class Executor {
    constructor({resourceKey, actionKey, params={}, options}) {
      params = _.cloneDeep(params);
      options = _.defaults(options, {useMiddleware: true, shouldLog: true, deepInclude: false});

      var {files} = options;

      if (_.includes(['get', 'create'], actionKey)) {
        params.where = _.defaults(params.where, {deleted: 0});
      }

      var pluralResourceKey = pluralize(resourceKey);
      var quantityMode = resourceKey === pluralResourceKey && actionKey !== 'create' ? 'many' : 'one';
      var originalParams = _.cloneDeep(params);
      var resourceKey = singularize(resourceKey);
      var schema = schemas[resourceKey];
      var modifyParams = _.get(schema, 'permissionsData.modifyParams');

      if (!schema) throw new Error('Invalid resourceKey');

      //default params
      params = _.defaultsDeep(params, schema.defaultParams);

      //deleted
      if (_.includes(['get', 'create'], actionKey)) {
        params.where = _.defaults(params.where, {deleted: 0});
      }

      //* fields
      if (_.includes(params.fields, '*')) {
        params.fields = [
          ..._.filter(params.fields, fieldKey => fieldKey !== '*'),
          ..._.keys(schema.fields)
        ];
      }

      if (modifyParams) {
        var {user} = options;
        var permissionGroup = permissions.groupFor({user});

        modifyParams({params, user, permissionGroup, actionKey});
      }

      var tableNameMap = _.mapValues(schemas, 'tableName');
      var fieldToColumnNameMap = {}, permittedFields = [];

      _.forEach(schema.fields, ({columnName}, fieldKey) => {
        permittedFields.push(fieldKey);

        fieldToColumnNameMap[fieldKey] = columnName;
      });

      var tableName = tableNameMap[resourceKey];
      var queryData = {string: '', args: []};

      var date = moment().utc().format('YYYY-MM-DD HH:mm:ss');

      _.extend(this, {
        resourceKey, pluralResourceKey, quantityMode, schema,
        actionKey,  params, originalParams,
        tableNameMap, fieldToColumnNameMap, permittedFields,
        tableName, queryData,
        options, files, date
      });
    }

    async execute() {
      await this.runMiddleware({onKey: 'beforeCleanParams'});

      this.cleanParams();

      await this.runMiddleware({onKey: 'beforeQuery'});

      await this.setInitialQueryData();
      await this.setWhereQueryData();
      await this.setOrderQueryData();
      await this.setLimitQueryData();

      this.result = await this.getTransformedQueryResult();

      await this.runMiddleware({onKey: 'beforeInclude'});

      await this.setIncludeData();

      await this.runMiddleware({onKey: 'afterExecute'});

      return this.result;
    }

    async runMiddleware(args) {
      if (this.options.useMiddleware) {
        await middlewareRunner.run({
          db,
          middleware,
          dbOptions: this.options,
          ..._.pick(this, ['resourceKey', 'actionKey', 'originalParams', 'params', 'queryData', 'files']),
          ...args
        });
      }
    }

    //< params

    stringifyJsonParams() {
      _.forEach(this.params.props, (value, key) => {
        if (this.schema.fields[key] && this.schema.fields[key].type === 'json') {
          this.params.props[key] = JSON.stringify(value);
        }
      });
    }

    cleanParams() {
      this.stringifyJsonParams();

      if (this.params.fields && !_.includes(this.params.fields, 'id')) this.params.fields.push('id');
      if (this.params.props && this.actionKey === 'update') delete this.params.props.id;

      //auto date detection
      var dateFieldKeys = [];

      if (this.actionKey === 'create') dateFieldKeys = ['created', 'lastUpdated'];
      if (this.actionKey === 'update') dateFieldKeys = ['lastUpdated'];

      _.forEach(dateFieldKeys, dateFieldKey => {
        if (this.params.props[dateFieldKey] === undefined && this.schema.fields[dateFieldKey] !== undefined) {
          this.params.props[dateFieldKey] = this.date;
        }
      });

      //TODO last updater id

      //filtering out [undefined] where values - identified a bug in PO website that is somewhat unresolved - may not be necessary
      if (this.params.where) {
        this.params.where = _.mapValues(this.params.where, whereValue => {
          return Array.isArray(whereValue) ? _.filter(whereValue, v => v !== undefined) : whereValue;
        });
      }

      _.forEach(_.pick(this.params, ['where', 'order', 'fields', 'props']), (param, paramKey) => {
        if (Array.isArray(param)) {
          param = _.filter(param, (value) => {
            if (paramKey === 'order' && typeof(value) === 'object') {
              return _.includes(this.permittedFields, value.field) && _.includes(['desc', 'asc'], value.direction);
            }
            else {
              return _.includes(this.permittedFields, value);
            }
          });

          param = _.map(param, (value) => {
            if (paramKey === 'order') {
              if (typeof(value) === 'string') {
                value = {field: value, direction: 'asc'};
              }

              return {columnName: this.fieldToColumnNameMap[value.field] || value.field, direction: value.direction};
            }
            else {
              return this.fieldToColumnNameMap[value] || value;
            }
          });
        }
        else {
          param = _.pickBy(param, (value, key) => _.includes(this.permittedFields, key));
          param = _.mapKeys(param, (value, key) => this.fieldToColumnNameMap[key] || key);
        }

        this.params[paramKey] = param;
      });
    }

    //> params
    //< build query data

    async setInitialQueryData() {
      if (this.actionKey === 'create') {
        this.queryData.string = `INSERT INTO \`${this.tableName}\` (${_.map(_.keys(this.params.props), key => `\`${key}\``).join(', ')}) VALUES (${_.map(this.params.props, () => '?')})`;
        this.queryData.args = _.values(this.params.props);
      }
      else if (this.actionKey === 'update') {
        var setSql = _.map(_.keys(this.params.props), key => `\`${key}\` = ? `).join(', ');

        this.queryData.string = `UPDATE \`${this.tableName}\` SET ${setSql} `;
        this.queryData.args = _.values(this.params.props);
      }
      else if (this.actionKey === 'get') {
        var selectSql = this.params.fields ? _.map(this.params.fields, key => `\`${this.tableName}\`.\`${key}\``).join(', ') : `\`${this.tableName}\`.*`;

        this.queryData.string = `SELECT ${selectSql} FROM \`${this.tableName}\` `;
      }
      else if (this.actionKey === 'destroy') {
        var mightBeAccidentallyDeletingAll = (!this.params.where || _.size(this.params.where) === 0) && !this.params.destroyAll;

        if (mightBeAccidentallyDeletingAll) {
          throw new Error('Delete all failed');
        }
        else {
          this.queryData.string = `UPDATE \`${this.tableName}\` SET deleted = 1 `;

          if (this.schema.fields.lastUpdated) {
            this.queryData.string += `, last_updated = ?`;
            this.queryData.args = [this.date];
          }
        }
      }
    }

    async setWhereQueryData(queryData) {
      if (_.includes(['get', 'update', 'destroy'], this.actionKey)) {
        if (this.params.where) {
          this.queryData.whereSqlStrings = _.map(this.params.where, (value, key) => {
            var string;

            if (!(value && value.operator !== undefined)) {
              value = {operator: Array.isArray(value) ? 'in' : '=', value};
            }

            if (value && value.operator) {
              var operator = {
                '>': '>',
                '>=': '>=',
                '<=': '<=',
                '<': '<',
                '=': '=',
                '!=': '!=',
                'in': 'IN',
                '!in': 'NOT IN',
                'like': 'LIKE',
                '!like': 'NOT LIKE'
              }[value.operator];

              var isEmptyArray = Array.isArray(value.value) && value.value.length === 0;

              if (!isEmptyArray && operator) {
                var preparedValue = _.includes(['IN', 'NOT IN'], operator) ? '(?)' : '?';

                string = `\`${this.tableName}\`.\`${key}\` ${operator} ${preparedValue}`;
              }
            }

            if (!string) {
              string = '1 = 2';

              delete this.params.where[key];
            }

            return string;
          });

          this.queryData.args.push(..._.map(this.params.where, value => (value && value.value) ? value.value : value));

          //WARNING any modifications to args/strings should come after here
          //WARNING because they need to have matching indices
          //REF hasPermissionUserId - src/lib/auth/permissions/permissions.js

          var hasPermissionUserId = _.get(this, `originalParams.where.hasPermissionUserId`);

          if (hasPermissionUserId) {
            //HINT eventually we'll actually use canRead, canWrite, but they're just there for future-proofness for now
            this.queryData.whereSqlStrings.push(`user_id = ? OR JSON_EXTRACT(permissions, ?) IS NOT NULL`);
            this.queryData.args.push(hasPermissionUserId, `$.sharedUserIds."${hasPermissionUserId}"`);
          }

          await this.runMiddleware({queryData, onKey: 'queryWhere'});
          await this.filterByAssociations();

          if (this.queryData.whereSqlStrings.length) {
            this.queryData.string += ` WHERE ${this.queryData.whereSqlStrings.join(' AND ')}`;
          }
        }
      }
    }

    async filterByAssociations() {
      var {originalParams, queryData, resourceKey} = this;
      var {where} = originalParams;

      var schema = schemas[resourceKey];

      var {childEdgeResourceKeys} = schema; //TODO get from relationships?
      var {associations} = schema.fields;

      if (where) {
        if (childEdgeResourceKeys) {
          await lib.async.forEach(childEdgeResourceKeys, async (childResourceKey) => {
            var whereKey = `${childResourceKey}Id`;

            if (where[whereKey] !== undefined) {
              var ids = Array.isArray(where[whereKey]) ? where[whereKey] : [where[whereKey]];

              queryData.whereSqlStrings.push(` EXISTS (SELECT NULL FROM edges WHERE edges.from_resource_key = ? AND edges.to_resource_key = ? AND edges.from_id = \`${this.tableName}\`.id AND edges.to_id IN (?) AND deleted = 0)`);
              queryData.args.push(resourceKey, childResourceKey, ids);
            }
          });
        }
        else if (associations) {
          await lib.async.forEach(associations.associatedResourceKeys, async ({associationsKey, resourceKey}) => {
            var whereKey = `${resourceKey}Id`;

            if (where[whereKey] !== undefined) {
              var ids = Array.isArray(where[whereKey]) ? where[whereKey] : [where[whereKey]];
              var whereStrings = _.map(ids, () => `JSON_EXTRACT(\`${this.tableName}\`.\`${associations.columnName}\`, ?) IS NOT NULL`);

              queryData.args.push(..._.map(ids, id => `$.${associationsKey}.id_${id}`));
              queryData.whereSqlStrings.push(`(${_.join(whereStrings, ' OR ')})`);
            }
          });
        }
      }
    }

    async setOrderQueryData() {
      if (this.actionKey === 'get') {
        if (this.params.order && this.params.order.length > 0) {
          this.queryData.string += ` ORDER BY ${_.join(_.map(this.params.order, ({columnName, direction}) => `\`${this.tableName}\`.\`${columnName}\` ${direction}`), ', ')}`;
        }
      }
    }

    async setLimitQueryData() {
      var {actionKey, quantityMode, params, queryData} = this;

      if (actionKey === 'get') {
        if (quantityMode === 'many') {
          if (params.page) {
            var limitOffset = (params.page.number - 1) * params.page.count;

            queryData.string += ` LIMIT ?, ?`;
            queryData.args.push(limitOffset, params.page.count);
          }
          else if (params.limit) {
            queryData.string += ` LIMIT ?`;
            queryData.args.push(params.limit);
          }
        }
        else if (quantityMode === 'one') {
          queryData.string += ` LIMIT 1`;
        }
      }
    }

    //> build query data
    //< transform result

    async getTransformedQueryResult() {
      var resourceData;
      var shouldRun = !(this.actionKey === 'update' && _.size(this.params.props) === 0);

      if (shouldRun) {
        this.queryData.results = await db.query(this.queryData.string, this.queryData.args, this.options);

        if (this.actionKey === 'create') {
          this.queryData.results = [{...this.params.props, id: this.queryData.results.insertId}];
        }

        var resourceData;

        if (_.includes(['get', 'create'], this.actionKey)) {
          var resources = _.map(this.queryData.results, result => {
            var resource = {};

            _.forEach(this.schema.fields, ({columnName, defaultValue, type}, fieldKey) => {
              var isCreateIdField = fieldKey === 'id' && this.actionKey === 'create';
              var fieldValue = (columnName && !isCreateIdField) ? result[columnName] : result[fieldKey];

              //WARNING json columns should still get null rather
              //WARNING than undefined when no defaultValue is specified
              if (!_.isNil(fieldValue)) {
                if (type === 'json' && dbConfig.type !== 'postgresql') fieldValue = JSON.parse(fieldValue);

                resource[fieldKey] = fieldValue;
              }
              else if (defaultValue !== undefined) {
                resource[fieldKey] = _.cloneDeep(defaultValue);
              }
            });

            return resource;
          });

          this.queryData.resources = resources;

          resourceData = this.quantityMode === 'many' ? resources : resources[0];
        }
      }

      return resourceData;
    }

    async setIncludeData() {
      var {include} = this.params;
      var {resourceKey} = this;

      if (include && _.size(include) > 0 && this.actionKey === 'get') {
        var relationshipsIndex = relationships.index;

        if (relationshipsIndex[resourceKey]) {
          var {children} = relationshipsIndex[resourceKey];
          var ownedIncludes = {}, directInclude = include;

          if (Array.isArray(include)) {
            var [directInclude, ...include] = include;

            if (typeof(directInclude) === 'string') directInclude = {[directInclude]: {}};
          }

          ownedIncludes = _.pickBy(directInclude, (params, key) => !!children[key]);

          if (!this.options.deepInclude) {
            include = _.pickBy(directInclude, (params, key) => !children[key]);
          }

          //make requests for all included items that are owned by the current resource
          await lib.async.forEach(ownedIncludes, async (params, childResourceKey) => {
            var resources = _.filter(Array.isArray(this.result) ? this.result : [this.result], resource => resource !== undefined);

            if (resources.length) {
              var parentChildRelationship = children[childResourceKey];
              var usingEdges = _.includes(['childEdge', 'parentEdge'], parentChildRelationship);

              if (usingEdges) {
                //i.e. media & products: media is parent
                //i.e. product including media: from media to product - getting fromIds
                //i.e. media including product: from media to product - getting toIds
                var direction = parentChildRelationship === 'childEdge' ? 'to' : 'from';
                var inverseDirection = direction === 'from' ? 'to' : 'from';

                var edges = await db.get('edges', {where: {
                  [`${direction}Id`]: _.map(resources, 'id'),
                  [`${direction}ResourceKey`]: resourceKey,
                  [`${inverseDirection}ResourceKey`]: singularize(childResourceKey)
                }});

                var childField = 'id';
                var parentField = 'id';
                var whereField = 'id';
                var parentFieldValues = _.map(edges, `${inverseDirection}Id`);

                //HINT edgeMap is a performance improvement over using _.some
                var edgeMap = {};

                var edgeMapKey1 = `${direction}Id`;
                var edgeMapKey2 = `${inverseDirection}Id`;

                _.forEach(edges, edge => {
                  edgeMap[`${edgeMapKey1}-${edge[edgeMapKey1]}_${edgeMapKey2}-${edge[edgeMapKey2]}`] = true;
                });
              }
              else {
                var {childField, parentField} = parentChildRelationship;
                var parentFieldValues = _.map(resources, parentField); //{product_tags: {id_1: {},  }}
                var whereField = childField;

                if (childField === 'associations') {
                  whereField = `${singularize(resourceKey)}Id`;
                }
                else if (parentField === 'associations') {
                  whereField = 'id';
                  parentFieldValues = _.flatMap(parentFieldValues, associations => {
                    var childAssociations = _.get(associations, `${pluralize(childResourceKey)}`, {});

                    return _.map(_.keys(childAssociations), key => parseInt(key.replace('id_', '')));
                  });
                }
              }

              //istanbul ignore if
              if (!usingEdges && (!childField || !parentField)) {
                throw new Error(`improperly formatted relationship: ${resourceKey}-${childResourceKey}`);
              }

              //send off request for actual resources - done in aggregate manner for query efficiency
              var childResources = await db.get(pluralize(childResourceKey), _.merge(_.cloneDeep(params), {
                where: {[whereField]: parentFieldValues}, include
              }), this.options);

              //pair up resources with associated child resources
              _.forEach(resources, (resource) => {
                var parentFieldValue = resource[parentField];

                if (usingEdges) {
                  var associatedChildResources = _.filter(childResources, childResource => {
                    return edgeMap[`${edgeMapKey1}-${parentFieldValue}_${edgeMapKey2}-${childResource.id}`];
                  });
                }
                else if (childField === 'associations') {
                  var associatedChildResources = _.filter(childResources, childResource => {
                    return _.get(childResource, `associations.${pluralize(resourceKey)}.id_${parentFieldValue}`) !== undefined;
                  });
                }
                else if (parentField === 'associations') {
                  //WARNING: product-options are still kebab case in product associations
                  var associatedChildResources = _.filter(childResources, childResource => {
                    return _.get(resource, `associations.${pluralize(childResourceKey)}.id_${childResource.id}`) !== undefined;
                  });
                }
                else {
                  var associatedChildResources = _.filter(childResources, {[childField]: parentFieldValue});
                }

                //store reference to matched up resources
                if (childResourceKey === pluralize(childResourceKey)) {
                  resource[childResourceKey] = associatedChildResources;
                }
                else if (associatedChildResources.length > 0) {
                  resource[childResourceKey] =  _.maxBy(associatedChildResources, 'id');
                }
              });
            }
          });
        }
      }
    }

    //> transform result
  }

  return Executor;
};
