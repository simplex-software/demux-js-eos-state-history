# demux-js-eos-state-history [![Build Status](https://travis-ci.org/simplex-software/demux-js-eos-state-history.svg?branch=master)](https://travis-ci.org/simplex-software/demux-js-eos-state-history)
Demux Action Reader implementation to read block and action data from EOS State History.

## Installation


```bash
# Using yarn
yarn add demux-eos-state-history

# Using npm
npm install demux-eos-state-history --save
```

#### Setup

To use the `StateHistoryWsActionReader`, you must first make sure that your environment is properly configured. To set up a proper environment, make sure the following are true:

- The node you are connecting to:
  - Has the `eosio::state_history_plugin` enabled
  - Is connected to the node(s) producing blocks via the `p2p-peer-address` configuration 
  - Has the `read-mode` configuration set to `read-only`
  - Has the `trace-history` configuration enabled


#### Inline and Deferred Actions

Unlike the `NodeosActionReader` from [demux-js-eos](https://github.com/EOSIO/demux-js-eos), inline and deferred actions are able to be captured and passed on to the Action Handler.

#### Example

```javascript
const { BaseActionWatcher } = require("demux")
const { StateHistoryWsActionReader } = require("demux-eos-state-history")

// See supported Action Handlers here: https://github.com/EOSIO/demux-js#class-implementations
const actionHandler = ...

const actionReader = new StateHistoryWsActionReader({
  startAtBlock: 1234,                         // startAtBlock: the first block relevant to our application
  onlyIrreversible: false,                    // onlyIrreversible: whether or not to only process irreversible blocks
  nodeosRPCEndpoint: "http://localhost:8888", // Nodeos RPC URL. This is used to fetch smart contracts ABIs
  nodeosWSEndpoint: "ws://localhost:8080"     // Nodeos Websocket endpoint. It's configured using the state-history-endpoint configuration
})

const actionWatcher = new BaseActionWatcher(actionReader, actionHander, 500)

// This must be done before calling watch
actionReader.initialize().then(() =>
  actionWatcher.watch()
)
```


## License

[MIT](./LICENSE)
