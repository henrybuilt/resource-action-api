var {singularize, pluralize} = require('inflection');

var permissions = {
  byResource: {
    //employee *, user *
    project: {employee: '*'/*, user: '*'*/},
      projectVersion: {employee: '*'/*, user: '*'*/},
        kitInstance: {employee: '*'/*, user: '*'*/},
        floor: {employee: '*'/*, user: '*'*/},
          room: {employee: '*'/*, user: '*'*/},
            wall: {employee: '*'/*, user: '*'*/},
            scope: {employee: '*'/*, user: '*'*/},
            archElementInstance: {employee: '*'/*, user: '*'*/},
            containerInstance: {employee: '*'/*, user: '*'*/},
              productInstance: {employee: '*'/*, user: '*'*/},
                partInstance: {employee: '*'/*, user: '*'*/},

    //employee get *
    appliance: {employee: {actions: {get: '*'}}},
    component: {employee: {actions: {get: '*'}}},
    document: {employee: {actions: {get: '*'}}},
    inputSet: {employee: {actions: {get: '*'}}},
    medium: {employee: {actions: {get: '*'}}},
    material: {employee: {actions: {get: '*'}}},
    materialClass: {employee: {actions: {get: '*'}}},
    part: {employee: {actions: {get: '*'}}},
    kit: {employee: {actions: {get: '*'}}},
    partCategory: {employee: {actions: {get: '*'}}},
    product: {employee: {actions: {get: '*'}}},
    productCategory: {employee: {actions: {get: '*'}}},

    // //misc
    // user: {
    //   user: {
    //     ownershipRequired: true,
    //     quantityModes: ['one'],
    //     actions: {
    //       get: {},
    //       update: {fields: ['email', 'name', 'password']}
    //     }
    //   },
    //   anyone: {
    //     actions: {
    //       create: {fields: ['email', 'name', 'password']},
    //       forgotPassword: {},
    //       resendConfirmationEmail: {}
    //     }
    //   }
    // }
  },
  groups: ['admin', 'employee', 'user', 'anyone']
};

permissions.groupFor = ({user}) => {
  var permissionGroup = 'anyone';

  if (user) {
    permissionGroup = 'user';

    if (user.level >= 2) permissionGroup = 'employee';
    if (user.admin === 1) permissionGroup = 'admin';
  }

  return permissionGroup;
};

permissions.userHasPermissionFor = async ({
  resourceKey, actionKey, params, user, db, resourcePathToUserId, hasPermissionByPropKey
}) => {
  var resourcesAreOwned = false, propsAreValid = false, ownedResources;

  //HINT require any userId prop to match current user's id
  hasPermissionByPropKey = {
    id: 'never',
    userId: ({value}) => value === user.id,
    ...hasPermissionByPropKey
  };

  var originalProps = params.props || {};

  allProps = Array.isArray(originalProps) ? originalProps : [originalProps];

  if (actionKey === 'create') {
    //HINT find (bottom - 1) records that contain userId (e.g. elevations for productInstances)
    if (resourcePathToUserId.length > 0) {
      var [topResourceKey, ...middleResourceKeys] = _.reverse(_.map(
        resourcePathToUserId, resourceKey => pluralize(resourceKey)));

      ownedResources = await db.get(topResourceKey, {
        where: {userId: user.id},
        include: lib.object.fromKeys(middleResourceKeys, () => ({}))
      }, {useMiddleware: false});

      _.times(ownedResources.length, depth => {
        ownedResources = _.flatMap(ownedResources, middleResourceKeys[depth]);
      });
    }

    resourcesAreOwned = true;
  }
  else {
    var userIdPath = [...resourcePathToUserId, 'userId'].join('.');
    var include = lib.object.fromKeys(resourcePathToUserId, () => ({}));
    var resources = await db.get(pluralize(resourceKey), {...params, include}, {useMiddleware: false});

    resourcesAreOwned = _.every(resources, [userIdPath, user.id]);
  }

  //HINT for each prop of each resource, use the provided hasPermission value if present
  propsAreValid = _.every(allProps, props => _.every(props, (propValue, propKey) => {
    var hasPermissionFor = hasPermissionByPropKey[propKey] || (() => true);

    if (hasPermissionFor === 'never') {
      hasPermissionFor = () => false;
    }
    else if (hasPermissionFor === 'byOwnedForeignResource') {
      hasPermissionFor = ({value, ownedResources}) => {
        return actionKey === 'create' && _.includes(_.map(ownedResources, 'id'), value);
      };
    }

    return hasPermissionFor({value: propValue, ownedResources});
  }));

  return resourcesAreOwned && propsAreValid;
};

permissions.hasPermissionFor = async ({user, resourceKey, actionKey, params, db}) => {
  var needsToken = true;
  var hasPermission = false;

  if (resourceKey) resourceKey = singularize(resourceKey);

  if (needsToken) {
    var permissionGroup = permissions.groupFor({user});

    if (user && user.permissions && user.permissions.admin) {
      var permissionsFromDatabase = user.permissions.admin;

      if (permissionsFromDatabase === '*') {
        hasPermission = true;
      }
      else {
        _.forEach(permissionsFromDatabase, (permissionStatus, snakeCaseResourceKey) => {
          var resourceKeyFromDatabase = _.camelCase(snakeCaseResourceKey);

          if (pluralize(resourceKeyFromDatabase) === pluralize(resourceKey) && permissionStatus === '*') {
            hasPermission = true;
          }
        });
      }
    }

    if (permissionGroup === 'admin') {
      hasPermission = true;
    }
    else {
      var permissionsForResource = permissions.byResource[resourceKey];

      if (permissionsForResource) {
        var groupPermissions = permissionsForResource[permissionGroup];

        if (groupPermissions) {
          var hasPermissionForAction = groupPermissions === '*' ||
            groupPermissions.actions[actionKey] === '*';

          if (hasPermissionForAction) {
            if (permissionGroup === 'employee') {
              hasPermission = true;
            }
            else if (permissionGroup === 'user') {
              var schema = require(`../../../schemas/${_.kebabCase(resourceKey)}`);

              if (schema.permissionsData) {
                hasPermission = await permissions.userHasPermissionFor({
                  params, db, user, actionKey, resourceKey, ...schema.permissionsData
                });
              }
            }
          }
        }
      }
    }
  }

  return hasPermission;
};

module.exports = permissions;
