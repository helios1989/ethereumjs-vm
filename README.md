# SYNOPSIS

[![NPM Package](https://img.shields.io/npm/v/ethereumjs-vm.svg?style=flat-square)](https://www.npmjs.org/package/ethereumjs-vm)
[![Build Status](https://img.shields.io/travis/ethereumjs/ethereumjs-vm.svg?branch=master&style=flat-square)](https://travis-ci.org/ethereumjs/ethereumjs-vm)
[![Gitter](https://img.shields.io/gitter/room/ethereum/ethereumjs-lib.svg?style=flat-square)](https://gitter.im/ethereum/ethereumjs-lib) or #ethereumjs on freenode

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

Implements Ethereum's VM in JS

# INSTALL
`npm install ethereumjs-vm`

# USAGE
```javascript
var VM = require('ethereumjs-vm')

//create a new VM instance
var vm = new VM()
var code = '7f4e616d65526567000000000000000000000000000000000000000000000000003055307f4e616d6552656700000000000000000000000000000000000000000000000000557f436f6e666967000000000000000000000000000000000000000000000000000073661005d2720d855f1d9976f88bb10c1a3398c77f5573661005d2720d855f1d9976f88bb10c1a3398c77f7f436f6e6669670000000000000000000000000000000000000000000000000000553360455560df806100c56000396000f3007f726567697374657200000000000000000000000000000000000000000000000060003514156053576020355415603257005b335415603e5760003354555b6020353360006000a233602035556020353355005b60007f756e72656769737465720000000000000000000000000000000000000000000060003514156082575033545b1560995733335460006000a2600033545560003355005b60007f6b696c6c00000000000000000000000000000000000000000000000000000000600035141560cb575060455433145b1560d25733ff5b6000355460005260206000f3'

vm.runCode({
  code: Buffer.from(code, 'hex') // code needs to be a Buffer,
  gasLimit: Buffer.from('ffffffff', 'hex')
}, function(err, results){
  console.log('returned: ' + results.return.toString('hex'));
})
```
Also more examples can be found here
- [examples](./examples)
- [old blog post](https://wanderer.github.io/ethereum/nodejs/code/2014/08/12/running-contracts-with-vm/)

# BROWSER
To build for standalone use in the browser, install `browserify` and check [run-transactions-simple exsample](https://github.com/ethereumjs/ethereumjs-vm/tree/master/examples/run-transactions-simple). This will give you a global variable `EthVM` to use. The generated file will be at `./examples/run-transactions-simple/build.js`.

# API
  - [`new VM([opts])`](#new-vmstatetrie-blockchain)
  - [`VM` methods](#vm-methods)
    - [`vm.runBlockchain([blockchain], [cb])`](#vmrunblockchainblockchain-cb)
    - [`vm.runBlock(opts, cb)`](#vmrunblockopts-cb)
    - [`vm.runTx(opts, cb)`](#vmruntxopts-cb)
    - [`vm.runCode(opts, cb)`](#vmruncodeopts-cb)
    - [`vm.generateCanonicalGenesis(cb)`](#vmgeneratecanonicalgenesiscb)
    - [`vm.generateGenesis(cb)`](#vmgenerategenesiscb)
  - [`VM` debugging hooks](#vm-debugging-hooks)
    - [`vm.onStep`](#vmonstep)

### `new VM([StateTrie], [blockchain])`
Creates a new VM object
- `StateTrie` - The [Patricia Merkle Tree](https://github.com/wanderer/merkle-patricia-tree) that contains the state. If no trie is given the `VM` will create an in memory trie.
- `blockchain` - an instance of the [`Blockchain`](https://github.com/ethereum/ethereumjs-lib/blob/master/docs/blockchain.md). If no blockchain is given a fake blockchain will be used.
- `opts`
  - `state` - the state trie
  - `blockchain` - an instance of ethereumjs-blockchain
  - `activatePrecompiles` - create entries in the state tree for the precompiled contracts

### `VM` methods


#### `vm.runBlockchain(blockchain, cb)`
Process blocks and adds them to the blockchain.
- `blockchain` - A [blockchain](https://github.com/ethereum/ethereumjs-blockchain) that to process
- `cb` - The callback. It is given an err parameter if it fails

--------------------------------------------------------

#### `vm.runBlock(opts, cb)`
Processes the `block` running all of the transactions it contains and updating the miner's account.
- `opts.block` - The [`Block`](https://github.com/ethereumjs/ethereumjs-block) to process
- `opts.generate` - a `Boolean`; whether to generate the stateRoot. If false  `runBlock` will check the stateRoot of the block against the Trie
- `cb` - The callback. It is given two arguments, an `error` string containing an error that may have happened or `null`, and a `results` object with the following properties:
  - `receipts` - the receipts from the transactions in the block
  - `results` - an Array for results from the transactions in the block
--------------------------------------------------------


#### `vm.runTx(opts, cb)`
Process a transaction.
- `opts.tx` - A [`Transaction`](https://github.com/ethereum/ethereumjs-tx) to run.
- `opts.block` - The block to which the `tx` belongs. If omitted a blank block will be used.
- `cb` - The callback. It is given two arguments, an `error` string containing an error that may have happened or `null`, and a `results` object with the following properties:
  - `amountSpent` - the amount of ether used by this transaction as a `bignum`
  - `gasUsed` - the amount of gas used by the transaction
  - `vm` - contains the results from running the code, if any, as described in [`vm.runCode(params, cb)`](#vmruncodeopts-cb)

--------------------------------------------------------

#### `vm.runCode(opts, cb)`
Runs EVM code
- `opts.code` - The EVM code to run given as a `Buffer`
- `opts.data` - The input data given as a `Buffer`
- `opts.value` - The value in ether that is being sent to `opt.address`. Defaults to `0`
- `opts.block` - The [`Block`](https://github.com/ethereumjs/ethereumjs-block) the `tx` belongs to. If omitted a blank block will be used.
- `opts.gasLimit` - The gas limit for the code given as a `Buffer`
- `opts.account` - The [`Account`](https://github.com/ethereumjs/ethereumjs-account) that the executing code belongs to. If omitted an empty account will be used
- `opts.address` - The address of the account that is executing this code. The address should be a `Buffer` of bytes. Defaults to `0`
- `opts.origin` - The address where the call originated from. The address should be a `Buffer` of 20bits. Defaults to `0`
- `opts.caller` - The address that ran this code. The address should be a `Buffer` of 20bits. Defaults to `0`
- `cb` - The callback. It is given two arguments, an `error` string containing an error that may have happened or `null` and a `results` object with the following properties
  - `gas` - the amount of gas left as a `bignum`
  - `gasUsed` - the amount of gas as a `bignum` the code used to run.
  - `gasRefund` - a `Bignum` containing the amount of gas to refund from deleting storage values
  - `selfdestruct` - an `Object` with keys for accounts that have selfdestructed and values for balance transfer recipient accounts.
  - `logs` - an `Array` of logs that the contract emitted.
  - `exception` - `0` if the contract encountered an exception, `1` otherwise.
  - `exceptionError` - a `String` describing the exception if there was one.
  - `return` - a `Buffer` containing the value that was returned by the contract


--------------------------------------------------------

#### `vm.stateManager.generateCanonicalGenesis(cb)`
Generates the Canonical genesis state.

--------------------------------------------------------

#### `vm.stateManager.generateGenesis(genesisData, cb)`
Generate the genesis state.
- `genesisData` - an `Object` whose keys are addresses and values are `string`s representing initial allocation of ether.
- `cb` - The callback

```javascript
var genesisData = {
  "51ba59315b3a95761d0863b05ccc7a7f54703d99": "1606938044258990275541962092341162602522202993782792835301376",
  "e4157b34ea9615cfbde6b4fda419828124b70c78": "1606938044258990275541962092341162602522202993782792835301376"
}

vm.generateGenesis(genesisData, function(){
  console.log('generation done');
})
```

### `events`
All events are instances of [async-eventemmiter](https://www.npmjs.com/package/async-eventemitter). If an event handler has an arity of 2 the VM will pause until the callback is called

#### `step`
The `step` event is given an `Object` and callback. The `Object` has the following properties.
- `pc` - a `Number` representing the program counter
- `opcode` - the next opcode to be ran
- `gas` - a `bignum` standing for the amount of gasLeft
- `stack` - an `Array` of `Buffers` containing the stack.
- `storageTrie` - the storage [trie](https://github.com/wanderer/merkle-patricia-tree) for the account
- `account` - the [`Account`](https://github.com/ethereum/ethereumjs-account) which owns the code running.
- `address` - the address of the `account`
- `depth` - the current number of calls deep the contract is
- `memory` - the memory of the VM as a `buffer`
- `cache` - The account cache. Contains all the accounts loaded from the trie. It is an instance of [functional red black tree](https://www.npmjs.com/package/functional-red-black-tree)

#### `beforeBlock`
Emits the block that is about to be processed.

#### `afterBlock`
Emits the results of the processing a block.

#### `beforeTx`
Emits the Transaction that is about to be processed.

#### `afterTx`
Emits the result of the transaction.

# TESTING

### Running Tests

_Note: Requires at least Node.js `8.0.0` installed to run the tests, this is because `ethereumjs-testing` uses `async/await` and other ES2015 language features_

Tests can be found in the ``tests`` directory, with ``FORK_CONFIG`` set in ``tests/tester.js``. There are test runners for [State tests](http://www.ethdocs.org/en/latest/contracts-and-transactions/ethereum-tests/state_tests/index.html) and [Blockchain tests](http://www.ethdocs.org/en/latest/contracts-and-transactions/ethereum-tests/blockchain_tests/index.html). VM tests are disabled since Frontier gas costs are not supported any more. Tests are then executed by the [ethereumjs-testing](https://github.com/ethereumjs/ethereumjs-testing) utility library using the official client-independent [Ethereum tests](https://github.com/ethereum/tests).

Running all the tests:

`npm test`

Running the State tests:

`node ./tests/tester -s`

Running the Blockchain tests:

`node ./tests/tester -b`

State tests run significantly faster than Blockchain tests, so it is often a good choice to start fixing State tests.

Running all the blockchain tests in a file:

`node ./tests/tester -b --file='randomStatetest303'`

Running a specific state test case:

`node ./tests/tester -s --test='stackOverflow'`

For a wider picture about how to use tests to implement EIPs you can have a look at this [reddit post](https://www.reddit.com/r/ethereum/comments/6kc5g3/ethereumjs_team_is_seeking_contributors/)
or the associated YouTube video introduction to [core development with Ethereumjs-vm](https://www.youtube.com/watch?v=L0BVDl6HZzk&feature=youtu.be).

### Debugging

Blockchain tests support `--debug` to verify the postState:

`node ./tests/tester -b  --debug --test='ZeroValue_SELFDESTRUCT_ToOneStorageKey_OOGRevert_d0g0v0_EIP158'`

All/most State tests are replicated as Blockchain tests in a ``GeneralStateTests`` [sub directory](https://github.com/ethereum/tests/tree/develop/BlockchainTests/GeneralStateTests) in the Ethereum tests repo, so for debugging single test cases the Blockchain test version of the State test can be used.

For comparing ``EVM`` traces [here](https://gist.github.com/cdetrio/41172f374ae32047a6c9e97fa9d09ad0) are some instructions for setting up ``pyethereum`` to generate corresponding traces for state tests.

# Internal Structure
The VM processes state changes at many levels.

* runBlockchain
  * for every block, runBlock
* runBlock
  * for every tx, runTx
  * pay miner and uncles
* runTx
  * check sender balance
  * check sender nonce
  * runCall
  * transfer gas charges
* runCall
  * checkpoint state
  * transfer value
  * load code
  * runCode
  * materialize created contracts
  * revert or commit checkpoint
* runCode
  * iterate over code
  * run op codes
  * track gas usage
* OpFns
  * run individual op code
  * modify stack
  * modify memory
  * calculate fee

The opFns for `CREATE`, `CALL`, and `CALLCODE` call back up to `runCall`.


# LICENSE
[MPL-2.0](https://www.mozilla.org/MPL/2.0/)
