
## `POST` `/resources`

Requests to `/resources` must have a body that has the following format:

```javascript
{
  [actionKey]: {
    [resourceKey]: <params|[params]>,
    ...
  },
  ...
}
```

`actionKey`:
- `get` - request data for resource(s)
- `create` - create resource(s)
- `update` - update resource(s)
- `destroy` - delete resource(s)

`resourceKey`:
- there are many `resourceKey`s, such as `products` and `projects`.
- `resourceKey`s can be:
    - singular, like `product`, in which case it is considered a `one` request (which has one corresponding result)
    - plural
- usually the value of a `resourceKey` will be an object - `params`
- occasionally, the value of a `resourceKey` will be an array of `params` objects - `[params, ...]`

| param 	   | behavior 	                	   | value format 				          | works with 			          |
| --- 		   | --- 		                       	 | --- 					                  | --- 				                |
| `where` 	 | `WHERE field = value AND ...`	 | `{<field>:<value>}` 		        | `get`, `update`, `destroy` |
| `props` 	 | `SET field = value`           	 | `{<field>:<value>}` 		        | `create`, `update` 		    |
| `fields`   | `SELECT field, ...`           	 | `[<field>]` 			              | `get` 			                |
| `order`  	 | `ORDER BY field, ...`         	 | `[<field|{field, direction}>]`  | `get` 			                |
| `include`  | include related `resource`s     | `{<resourceKey>: <params>>`    | `get` 			                |
| `limit`  	 | `LIMIT X`		        	         | `int` 				                  | `get` 			                |
| `page`  	 | `LIMIT X, Y`		        	       | `{count: int, number: int}`    | `get` 			                |

### `where`

default behavior: `AND` - `{where: {id: 1, type: 2}}` -> `WHERE id = 1 AND type = 2`

to achieve more complex where statements, the following syntax may be used (TODO):

`{where: ['and', ['or', {productId: 1, materialId: 2}], {type: 'image'}]}`

- recursively apply middleware? using pseudo field?

## Responses

Responses come back in a format that corresponds to the request:

```javascript
{success: true, data: {
  [actionKey]: {
    [singular resourceKey]: {props: {}}
    [plural   resourceKey]: [{props: {}}]
  }
}}
```

`resource`:
- an object of the format `{props: {}}`
- only `get`, and `create` respond with resources, so `data.resources` will never have the keys `update` or `destroy`

## Example request and response:

```javascript
var request = {
  get: {
    project: {where: {id: 1}},
    products: {where: {categoryId: 1}, order: ['rank'], fields: ['id', 'title']},
  },
  update: {
    project: {where: {id: 1}, props: {title: 'p1'}},
    projects: {where: {zip: 10000}, props: {title: 'p2'}},
    elevations: [{where: {id: 1}, props: {title: 'p3'}}, {where: {id: 2}, props: {title: 'p4'}}]
  },
  create: {
    product: {where: {zip: 10000}, props: {title: 'p1'}},
    projects: [{props: {title: 'p1'}}, {props: {title: 'p2'}}]
  },
  destroy: {
    product: {where: {id: 1}},
    projects: {where: {zip: 10000}}
  }
};

var response = {
  resources: {
    get: {
      project: {},
      products: [{}, ...],
    },
    update: {
      project: {},
      projects: [{}, ...],
      elevations: [{}, ...]
    },
    create: {
      product: {},
      projects: [{}, ...]
    },
    destroy: {
      product: {},
      projects: [{}, ...]
    }
  }
}
```
