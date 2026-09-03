# Record Log Adapter

`recordLog.js` provides the small route-facing adapter used to configure action logging with a fixed action name.

## Usage

```js
router.post(
	"/",
	recordLog({ actionLogModel, permissionModel }, "contact:add"),
	controller.register.bind(controller),
);
```

The adapter forwards the supplied model dependencies and action name to `actionLog/actionLog.js`. It returns a standard Express request handler, so it can be placed directly in a router middleware chain.

## Responsibility boundary

This module does not inspect requests or persist audit records itself. Use `actionLog/actionLog.js` when a route needs dynamic actions, custom metadata, or explicit control of the `shouldRun` option.
