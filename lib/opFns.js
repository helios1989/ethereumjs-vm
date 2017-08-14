const Buffer = require('safe-buffer').Buffer
const async = require('async')
const fees = require('ethereum-common')
const utils = require('ethereumjs-util')
const BN = utils.BN
const constants = require('./constants.js')
const logTable = require('./logTable.js')
const ERROR = constants.ERROR

// the opcode functions
module.exports = {
  STOP: function (runState) {
    runState.stopped = true
  },
  ADD: function (a, b, runState) {
    return Buffer.from(
      new BN(a)
        .iadd(new BN(b))
        .mod(utils.TWO_POW256)
        .toArray('be', 32))
  },
  MUL: function (a, b, runState) {
    return Buffer.from(
      new BN(a)
        .imul(new BN(b))
        .mod(utils.TWO_POW256)
        .toArray('be', 32)
    )
  },
  SUB: function (a, b, runState) {
    return utils.toUnsigned(
      new BN(a)
        .isub(new BN(b))
    )
  },
  DIV: function (a, b, runState) {
    b = new BN(b)

    var r
    if (b.isZero()) {
      r = [0]
    } else {
      a = new BN(a)
      r = a.div(b).toArray('be', 32)
    }
    return Buffer.from(r)
  },
  SDIV: function (a, b, runState) {
    b = utils.fromSigned(b)

    var r
    if (b.isZero()) {
      r = Buffer.from([0])
    } else {
      a = utils.fromSigned(a)
      r = utils.toUnsigned(a.div(b))
    }

    return r
  },
  MOD: function (a, b, runState) {
    b = new BN(b)
    var r
    if (b.isZero()) {
      r = [0]
    } else {
      a = new BN(a)
      r = a.mod(b).toArray('be', 32)
    }

    return Buffer.from(r)
  },
  SMOD: function (a, b, runState) {
    b = utils.fromSigned(b)
    var r

    if (b.isZero()) {
      r = Buffer.from([0])
    } else {
      a = utils.fromSigned(a)
      r = a.abs().mod(b.abs())
      if (a.isNeg()) {
        r = r.ineg()
      }

      r = utils.toUnsigned(r)
    }
    return r
  },
  ADDMOD: function (a, b, c, runState) {
    c = new BN(c)
    var r

    if (c.isZero()) {
      r = [0]
    } else {
      a = new BN(a).iadd(new BN(b))
      r = a.mod(c).toArray('be', 32)
    }

    return Buffer.from(r)
  },
  MULMOD: function (a, b, c, runState) {
    c = new BN(c)
    var r

    if (c.isZero()) {
      r = [0]
    } else {
      a = new BN(a).imul(new BN(b))
      r = a.mod(c).toArray('be', 32)
    }

    return Buffer.from(r)
  },
  EXP: function (base, exponent, runState) {
    base = new BN(base)
    exponent = new BN(exponent)
    var m = BN.red(utils.TWO_POW256)
    var result

    base = base.toRed(m)

    if (!exponent.isZero()) {
      var bytes = 1 + logTable(exponent)
      subGas(runState, new BN(bytes).muln(fees.expByteGas.v))
      result = Buffer.from(base.redPow(exponent).toArray('be', 32))
    } else {
      result = Buffer.from([1])
    }

    return result
  },
  SIGNEXTEND: function (k, val, runState) {
    k = new BN(k)
    val = Buffer.from(val) // use clone, don't modify object reference
    var extendOnes = false

    if (k.cmpn(31) <= 0) {
      k = k.toNumber()

      if (val[31 - k] & 0x80) {
        extendOnes = true
      }

      // 31-k-1 since k-th byte shouldn't be modified
      for (var i = 30 - k; i >= 0; i--) {
        val[i] = extendOnes ? 0xff : 0
      }
    }

    return val
  },
  // 0x10 range - bit ops
  LT: function (a, b, runState) {
    return Buffer.from([
      new BN(a)
        .cmp(new BN(b)) === -1
    ])
  },
  GT: function (a, b, runState) {
    return Buffer.from([
      new BN(a)
        .cmp(new BN(b)) === 1
    ])
  },
  SLT: function (a, b, runState) {
    return Buffer.from([
      utils.fromSigned(a)
        .cmp(utils.fromSigned(b)) === -1
    ])
  },
  SGT: function (a, b, runState) {
    return Buffer.from([
      utils.fromSigned(a)
        .cmp(utils.fromSigned(b)) === 1
    ])
  },
  EQ: function (a, b, runState) {
    a = utils.unpad(a)
    b = utils.unpad(b)
    return Buffer.from([a.toString('hex') === b.toString('hex')])
  },
  ISZERO: function (a, runState) {
    a = new BN(a)
    return Buffer.from([a.isZero()])
  },
  AND: function (a, b, runState) {
    return Buffer.from(
      new BN(a)
        .iand(new BN(b))
        .toArray('be', 32))
  },
  OR: function (a, b, runState) {
    return Buffer.from(
      new BN(a)
        .ior(new BN(b))
        .toArray('be', 32))
  },
  XOR: function (a, b, runState) {
    return Buffer.from(
      new BN(a)
        .ixor(new BN(b))
        .toArray('be', 32))
  },
  NOT: function (a, runState) {
    return Buffer.from(
      new BN(a)
        .inotn(256)
        .toArray('be', 32))
  },
  BYTE: function (pos, word, runState) {
    pos = new BN(pos)
    if (pos.gten(32)) {
      return Buffer.from([0])
    }

    pos = pos.toNumber()
    word = utils.setLengthLeft(word, 32)

    return utils.intToBuffer(word[pos])
  },
  // 0x20 range - crypto
  SHA3: function (offset, length, runState) {
    offset = new BN(offset)
    length = new BN(length)
    var data = memLoad(runState, offset, length)
    // copy fee
    subGas(runState, new BN(fees.sha3WordGas.v).imul(length.divRound(new BN(32))))
    return utils.sha3(data)
  },
  // 0x30 range - closure state
  ADDRESS: function (runState) {
    return runState.address
  },
  BALANCE: function (address, runState, cb) {
    var stateManager = runState.stateManager
    // stack to address
    address = utils.setLengthLeft(address, 20)

    // shortcut if current account
    if (address.toString('hex') === runState.address.toString('hex')) {
      cb(null, utils.setLengthLeft(runState.contract.balance, 32))
      return
    }

    // otherwise load account then return balance
    stateManager.getAccountBalance(address, cb)
  },
  ORIGIN: function (runState) {
    return runState.origin
  },
  CALLER: function (runState) {
    return runState.caller
  },
  CALLVALUE: function (runState) {
    return runState.callValue
  },
  CALLDATALOAD: function (pos, runState) {
    pos = new BN(pos)

    var loaded
    if (pos.gtn(runState.callData.length)) {
      loaded = Buffer.from([0])
    } else {
      pos = pos.toNumber()
      loaded = runState.callData.slice(pos, pos + 32)
      loaded = loaded.length ? loaded : Buffer.from([0])
    }

    return utils.setLengthRight(loaded, 32)
  },
  CALLDATASIZE: function (runState) {
    if (runState.callData.length === 1 && runState.callData[0] === 0) {
      return Buffer.from([0])
    } else {
      return utils.intToBuffer(runState.callData.length)
    }
  },
  CALLDATACOPY: function (memOffset, dataOffset, dataLength, runState) {
    memOffset = new BN(memOffset)
    dataLength = new BN(dataLength)
    dataOffset = new BN(dataOffset)

    memStore(runState, memOffset, runState.callData, dataOffset, dataLength)
    // sub the COPY fee
    subGas(runState, new BN(fees.copyGas.v).imul(dataLength.divRound(new BN(32))))
  },
  CODESIZE: function (runState) {
    return utils.intToBuffer(runState.code.length)
  },
  CODECOPY: function (memOffset, codeOffset, length, runState) {
    memOffset = new BN(memOffset)
    codeOffset = new BN(codeOffset)
    length = new BN(length)

    memStore(runState, memOffset, runState.code, codeOffset, length)
    // sub the COPY fee
    subGas(runState, new BN(fees.copyGas.v).imul(length.divRound(new BN(32))))
  },
  EXTCODESIZE: function (address, runState, cb) {
    var stateManager = runState.stateManager
    address = utils.setLengthLeft(address, 20)
    stateManager.getContractCode(address, function (err, code) {
      cb(err, utils.intToBuffer(code.length))
    })
  },
  EXTCODECOPY: function (address, memOffset, codeOffset, length, runState, cb) {
    var stateManager = runState.stateManager
    address = utils.setLengthLeft(address, 20)
    memOffset = new BN(memOffset)
    codeOffset = new BN(codeOffset)
    length = new BN(length)
    subMemUsage(runState, memOffset, length)

    // copy fee
    subGas(runState, new BN(fees.copyGas.v).imul(length.divRound(new BN(32))))

    stateManager.getContractCode(address, function (err, code) {
      code = err ? Buffer.from([0]) : code
      memStore(runState, memOffset, code, codeOffset, length, false)
      cb(err)
    })
  },
  GASPRICE: function (runState) {
    return utils.setLengthLeft(runState.gasPrice, 32)
  },
  // '0x40' range - block operations
  BLOCKHASH: function (number, runState, cb) {
    var stateManager = runState.stateManager
    var diff = new BN(runState.block.header.number).isub(new BN(number))

    // block lookups must be within the past 256 blocks
    if (diff.gtn(256) || diff.lten(0)) {
      cb(null, Buffer.from([0]))
      return
    }

    stateManager.getBlockHash(number, function (err, blockHash) {
      if (err) {
        // if we are at a low block height and request a blockhash before the genesis block
        cb(null, Buffer.from([0]))
      } else {
        cb(null, blockHash)
      }
    })
  },
  COINBASE: function (runState) {
    return utils.setLengthLeft(runState.block.header.coinbase, 32)
  },
  TIMESTAMP: function (runState) {
    return utils.setLengthLeft(runState.block.header.timestamp, 32)
  },
  NUMBER: function (runState) {
    return utils.setLengthLeft(runState.block.header.number, 32)
  },
  DIFFICULTY: function (runState) {
    return utils.setLengthLeft(runState.block.header.difficulty, 32)
  },
  GASLIMIT: function (runState) {
    return utils.setLengthLeft(runState.block.header.gasLimit, 32)
  },
  // 0x50 range - 'storage' and execution
  POP: function () {},
  MLOAD: function (pos, runState) {
    pos = new BN(pos)
    var loaded = utils.unpad(memLoad(runState, pos, new BN(32)))
    return loaded
  },
  MSTORE: function (offset, word, runState) {
    offset = new BN(offset)
    word = utils.setLengthLeft(word, 32)
    memStore(runState, offset, word, new BN(0), new BN(32))
  },
  MSTORE8: function (offset, byte, runState) {
    offset = new BN(offset)
    // grab the last byte
    byte = byte.slice(byte.length - 1)
    memStore(runState, offset, byte, new BN(0), new BN(1))
  },
  SLOAD: function (key, runState, cb) {
    var stateManager = runState.stateManager
    key = utils.setLengthLeft(key, 32)

    stateManager.getContractStorage(runState.address, key, function (err, value) {
      if (err) return cb(err)
      value = value.length ? value : Buffer.from([0])
      cb(null, value)
    })
  },
  SSTORE: function (key, val, runState, cb) {
    var stateManager = runState.stateManager
    var address = runState.address
    key = utils.setLengthLeft(key, 32)
    var value = utils.unpad(val)

    stateManager.getContractStorage(runState.address, key, function (err, found) {
      if (err) return cb(err)
      try {
        if (value.length === 0 && !found.length) {
          subGas(runState, new BN(fees.sstoreResetGas.v))
        } else if (value.length === 0 && found.length) {
          subGas(runState, new BN(fees.sstoreResetGas.v))
          runState.gasRefund.iadd(new BN(fees.sstoreRefundGas.v))
        } else if (value.length !== 0 && !found.length) {
          subGas(runState, new BN(fees.sstoreSetGas.v))
        } else if (value.length !== 0 && found.length) {
          subGas(runState, new BN(fees.sstoreResetGas.v))
        }
      } catch (e) {
        cb(e.error)
        return
      }

      stateManager.putContractStorage(address, key, value, function (err) {
        if (err) return cb(err)
        runState.contract = stateManager.cache.get(address)
        cb()
      })
    })
  },
  JUMP: function (dest, runState) {
    dest = new BN(dest)

    if (dest.gtn(runState.code.length)) {
      trap(ERROR.INVALID_JUMP + ' at ' + describeLocation(runState))
    }

    dest = dest.toNumber()

    if (!jumpIsValid(runState, dest)) {
      trap(ERROR.INVALID_JUMP + ' at ' + describeLocation(runState))
    }

    runState.programCounter = dest
  },
  JUMPI: function (dest, cond, runState) {
    dest = new BN(dest)
    cond = new BN(cond)

    if (!cond.isZero()) {
      if (dest.gtn(runState.code.length)) {
        trap(ERROR.INVALID_JUMP + ' at ' + describeLocation(runState))
      }

      dest = dest.toNumber()

      if (!jumpIsValid(runState, dest)) {
        trap(ERROR.INVALID_JUMP + ' at ' + describeLocation(runState))
      }

      runState.programCounter = dest
    }
  },
  PC: function (runState) {
    return utils.intToBuffer(runState.programCounter - 1)
  },
  MSIZE: function (runState) {
    return Buffer.from(runState.memoryWordCount.muln(32).toArray('be', 32))
  },
  GAS: function (runState) {
    return Buffer.from(runState.gasLeft.toArray('be', 32))
  },
  JUMPDEST: function (runState) {},
  PUSH: function (runState) {
    const numToPush = runState.opCode - 0x5f
    const loaded = utils.setLengthLeft(runState.code.slice(runState.programCounter, runState.programCounter + numToPush), 32)
    runState.programCounter += numToPush
    return loaded
  },
  DUP: function (runState) {
    const stackPos = runState.opCode - 0x7f
    if (stackPos > runState.stack.length) {
      trap(ERROR.STACK_UNDERFLOW)
    }
    // dupilcated stack items point to the same Buffer
    return runState.stack[runState.stack.length - stackPos]
  },
  SWAP: function (runState) {
    var stackPos = runState.opCode - 0x8f

    // check the stack to make sure we have enough items on teh stack
    var swapIndex = runState.stack.length - stackPos - 1
    if (swapIndex < 0) {
      trap(ERROR.STACK_UNDERFLOW)
    }

    // preform the swap
    var newTop = runState.stack[swapIndex]
    runState.stack[swapIndex] = runState.stack.pop()
    return newTop
  },
  LOG: function (memOffset, memLength) {
    var args = Array.prototype.slice.call(arguments, 0)
    args.pop() // pop off callback
    var runState = args.pop()
    var topics = args.slice(2)
    topics = topics.map(function (a) {
      return utils.setLengthLeft(a, 32)
    })

    memOffset = new BN(memOffset)
    memLength = new BN(memLength)
    const numOfTopics = runState.opCode - 0xa0
    const mem = memLoad(runState, memOffset, memLength)
    subGas(runState, new BN(fees.logTopicGas.v).imuln(numOfTopics).iadd(memLength.muln(fees.logDataGas.v)))

    // add address
    var log = [runState.address]
    log.push(topics)

    // add data
    log.push(mem)
    runState.logs.push(log)
  },

  // '0xf0' range - closures
  CREATE: function (value, offset, length, runState, done) {
    value = new BN(value)
    offset = new BN(offset)
    length = new BN(length)

    // set up config
    var options = {
      value: value
    }
    var localOpts = {
      inOffset: offset,
      inLength: length,
      outOffset: new BN(0),
      outLength: new BN(0)
    }

    checkCallMemCost(runState, options, localOpts)
    checkOutOfGas(runState, options)
    makeCall(runState, options, localOpts, done)
  },
  CALL: function (gasLimit, toAddress, value, inOffset, inLength, outOffset, outLength, runState, done) {
    var stateManager = runState.stateManager
    gasLimit = new BN(gasLimit)
    toAddress = utils.setLengthLeft(toAddress, 20)
    value = new BN(value)
    inOffset = new BN(inOffset)
    inLength = new BN(inLength)
    outOffset = new BN(outOffset)
    outLength = new BN(outLength)

    var data = memLoad(runState, inOffset, inLength)
    var options = {
      gasLimit: gasLimit,
      value: value,
      to: toAddress,
      data: data
    }
    var localOpts = {
      inOffset: inOffset,
      inLength: inLength,
      outOffset: outOffset,
      outLength: outLength
    }

    if (!value.isZero()) {
      subGas(runState, new BN(fees.callValueTransferGas.v))
    }

    stateManager.exists(toAddress, function (err, exists) {
      if (err) {
        done(err)
        return
      }

      stateManager.accountIsEmpty(toAddress, function (err, empty) {
        if (err) {
          done(err)
        }

        if (!exists || empty) {
          if (!value.isZero()) {
            try {
              subGas(runState, new BN(fees.callNewAccountGas.v))
            } catch (e) {
              done(e.error)
            }
          }
        }
      })

      try {
        checkCallMemCost(runState, options, localOpts)
        checkOutOfGas(runState, options)
      } catch (e) {
        done(e.error)
        return
      }

      if (!value.isZero()) {
        runState.gasLeft.iadd(new BN(fees.callStipend.v))
        options.gasLimit.iadd(new BN(fees.callStipend.v))
      }

      makeCall(runState, options, localOpts, done)
    })
  },
  CALLCODE: function (gas, toAddress, value, inOffset, inLength, outOffset, outLength, runState, done) {
    var stateManager = runState.stateManager
    gas = new BN(gas)
    toAddress = utils.setLengthLeft(toAddress, 20)
    value = new BN(value)
    inOffset = new BN(inOffset)
    inLength = new BN(inLength)
    outOffset = new BN(outOffset)
    outLength = new BN(outLength)

    const options = {
      gasLimit: gas,
      value: value,
      to: runState.address
    }

    const localOpts = {
      inOffset: inOffset,
      inLength: inLength,
      outOffset: outOffset,
      outLength: outLength
    }

    if (!value.isZero()) {
      subGas(runState, new BN(fees.callValueTransferGas.v))
    }

    checkCallMemCost(runState, options, localOpts)
    checkOutOfGas(runState, options)

    if (!value.isZero()) {
      runState.gasLeft.iadd(new BN(fees.callStipend.v))
      options.gasLimit.iadd(new BN(fees.callStipend.v))
    }

    if (utils.isPrecompiled(toAddress)) {
      options.compiled = true
      options.code = runState._precompiled[toAddress.toString('hex')]
      makeCall(runState, options, localOpts, done)
    } else {
      stateManager.getContractCode(toAddress, function (err, code, compiled) {
        if (err) return done(err)
        options.code = code
        options.compiled = compiled
        makeCall(runState, options, localOpts, done)
      })
    }
  },
  DELEGATECALL: function (gas, toAddress, inOffset, inLength, outOffset, outLength, runState, done) {
    var stateManager = runState.stateManager
    var value = runState.callValue
    gas = new BN(gas)
    toAddress = utils.setLengthLeft(toAddress, 20)
    inOffset = new BN(inOffset)
    inLength = new BN(inLength)
    outOffset = new BN(outOffset)
    outLength = new BN(outLength)

    const options = {
      gasLimit: gas,
      value: value,
      to: runState.address,
      caller: runState.caller,
      delegatecall: true
    }

    const localOpts = {
      inOffset: inOffset,
      inLength: inLength,
      outOffset: outOffset,
      outLength: outLength
    }

    checkCallMemCost(runState, options, localOpts)
    checkOutOfGas(runState, options)

    // load the code
    stateManager.getAccount(toAddress, function (err, account) {
      if (err) return done(err)
      if (utils.isPrecompiled(toAddress)) {
        options.compiled = true
        options.code = runState._precompiled[toAddress.toString('hex')]
        makeCall(runState, options, localOpts, done)
      } else {
        stateManager.getContractCode(toAddress, function (err, code, compiled) {
          if (err) return done(err)
          options.code = code
          options.compiled = compiled
          makeCall(runState, options, localOpts, done)
        })
      }
    })
  },
  RETURN: function (offset, length, runState) {
    offset = new BN(offset)
    length = new BN(length)
    runState.returnValue = memLoad(runState, offset, length)
  },
  // '0x70', range - other
  SELFDESTRUCT: function (selfdestructToAddress, runState, cb) {
    var stateManager = runState.stateManager
    var contract = runState.contract
    var contractAddress = runState.address
    var zeroBalance = new BN(0)
    selfdestructToAddress = utils.setLengthLeft(selfdestructToAddress, 20)

    stateManager.getAccount(selfdestructToAddress, function (err, toAccount) {
      // update balances
      if (err) {
        cb(err)
        return
      }

      stateManager.accountIsEmpty(selfdestructToAddress, function (error, empty) {
        if (error) {
          cb(error)
          return
        }

        if ((new BN(contract.balance)).gt(zeroBalance)) {
          if (!toAccount.exists || empty) {
            try {
              subGas(runState, new BN(fees.callNewAccountGas.v))
            } catch (e) {
              cb(e.error)
              return
            }
          }
        }

        // only add to refund if this is the first selfdestruct for the address
        if (!runState.selfdestruct[contractAddress.toString('hex')]) {
          runState.gasRefund = runState.gasRefund.add(new BN(fees.suicideRefundGas.v))
        }
        runState.selfdestruct[contractAddress.toString('hex')] = selfdestructToAddress
        runState.stopped = true

        var newBalance = Buffer.from(new BN(contract.balance).add(new BN(toAccount.balance)).toArray())
        async.series([
          stateManager.putAccountBalance.bind(stateManager, selfdestructToAddress, newBalance),
          stateManager.putAccountBalance.bind(stateManager, contractAddress, new BN(0))
        ], function (err) {
          // The reason for this is to avoid sending an array of results
          cb(err)
        })
      })
    })
  }
}

module.exports._DC = module.exports.DELEGATECALL

function describeLocation (runState) {
  var hash = utils.sha3(runState.code).toString('hex')
  var address = runState.address.toString('hex')
  var pc = runState.programCounter - 1
  return hash + '/' + address + ':' + pc
}

function subGas (runState, amount) {
  runState.gasLeft.isub(amount)
  if (runState.gasLeft.cmpn(0) === -1) {
    trap(ERROR.OUT_OF_GAS)
  }
}

function trap (err) {
  function VmError (error) {
    this.error = error
  }
  throw new VmError(err)
}

/**
 * Subtracts the amount needed for memory usage from `runState.gasLeft`
 * @method subMemUsage
 * @param {BN} offset
 * @param {BN} length
 * @return {String}
 */
function subMemUsage (runState, offset, length) {
  //  abort if no usage
  if (!length) return

  // hacky: if the dataOffset is larger than the largest safeInt then just
  // load 0's because if tx.data did have that amount of data then the fee
  // would be high than the maxGasLimit in the block
  const MAX_INT = 9007199254740991
  if (offset.gtn(MAX_INT) || length.gtn(MAX_INT)) {
    trap(ERROR.OUT_OF_GAS)
  }

  const newMemoryWordCount = offset.add(length).divRound(new BN(32))

  if (newMemoryWordCount.lte(runState.memoryWordCount)) return
  runState.memoryWordCount = newMemoryWordCount

  const words = newMemoryWordCount
  const fee = new BN(fees.memoryGas.v)
  const quadCoeff = new BN(fees.quadCoeffDiv.v)
  // words * 3 + words ^2 / 512
  const cost = words.mul(fee).add(words.mul(words).div(quadCoeff))

  if (cost.cmp(runState.highestMemCost) === 1) {
    subGas(runState, cost.sub(runState.highestMemCost))
    runState.highestMemCost = cost
  }
}

/**
 * Loads bytes from memory and returns them as a buffer. If an error occurs
 * a string is instead returned. The function also subtracts the amount of
 * gas need for memory expansion.
 * @method memLoad
 * @param {BN} offset where to start reading from
 * @param {BN} length how far to read
 * @return {Buffer|String}
 */
function memLoad (runState, offset, length) {
  // check to see if we have enougth gas for the mem read
  subMemUsage(runState, offset, length)

  // NOTE: in theory this could overflow, but unlikely due to OOG above
  offset = offset.toNumber()
  length = length.toNumber()

  var loaded = runState.memory.slice(offset, offset + length)
  // fill the remaining lenth with zeros
  for (var i = loaded.length; i < length; i++) {
    loaded.push(0)
  }
  return Buffer.from(loaded)
}

/**
 * Stores bytes to memory. If an error occurs a string is instead returned.
 * The function also subtracts the amount of gas need for memory expansion.
 * @method memStore
 * @param {BN} offset where to start reading from
 * @param {Buffer} val
 * @param {BN} valOffset
 * @param {BN} length how far to read
 * @param {Boolean} skipSubMem
 * @return {Buffer|String}
 */
function memStore (runState, offset, val, valOffset, length, skipSubMem) {
  if (skipSubMem !== false) {
    subMemUsage(runState, offset, length)
  }

  // NOTE: in theory this could overflow, but unlikely due to OOG above
  offset = offset.toNumber()
  length = length.toNumber()

  // Preload with zeroes in case one of the below has to truncate
  for (var i = 0; i < length; i++) {
//    runState.memory[offset + i] = 0
  }

  // Because EVM is stupied and has no good error handling...
  if (valOffset.gtn(val.length)) {
    return
  } else {
    valOffset = valOffset.toNumber()
  }

  var valLength = Math.min(val.length - valOffset, length)

  // read max possible from the value
  for (var i = 0; i < valLength; i++) {
    runState.memory[offset + i] = val[valOffset + i]
  }
}

// checks if a jump is valid given a destination
function jumpIsValid (runState, dest) {
  return runState.validJumps.indexOf(dest) !== -1
}

// checks to see if we have enough gas left for the memory reads and writes
// required by the CALLs
function checkCallMemCost (runState, callOptions, localOpts) {
  // calculates the gase need for reading the input from memory
  callOptions.data = memLoad(runState, localOpts.inOffset, localOpts.inLength)

  // calculates the gas need for saving the output in memory
  if (localOpts.outLength) {
    subMemUsage(runState, localOpts.outOffset, localOpts.outLength)
  }

  if (!callOptions.gasLimit) {
    callOptions.gasLimit = new BN(runState.gasLeft)
  }
}

function checkOutOfGas (runState, callOptions) {
  const gasAllowed = runState.gasLeft.sub(runState.gasLeft.div(new BN(64)))
  if (callOptions.gasLimit.gt(gasAllowed)) {
    callOptions.gasLimit = gasAllowed
  }
}

// sets up and calls runCall
function makeCall (runState, callOptions, localOpts, cb) {
  callOptions.caller = callOptions.caller || runState.address
  callOptions.origin = runState.origin
  callOptions.gasPrice = runState.gasPrice
  callOptions.block = runState.block
  callOptions.populateCache = false
  callOptions.selfdestruct = runState.selfdestruct

  // increment the runState.depth
  callOptions.depth = runState.depth + 1

  // check if account has enough ether
  // Note: in the case of delegatecall, the value is persisted and doesn't need to be deducted again
  if (runState.depth >= fees.stackLimit.v || (callOptions.delegatecall !== true && new BN(runState.contract.balance).cmp(callOptions.value) === -1)) {
    runState.stack.push(Buffer.from([0]))
    cb()
  } else {
    // if creating a new contract then increament the nonce
    if (!callOptions.to) {
      runState.contract.nonce = new BN(runState.contract.nonce).addn(1)
    }

    runState.stateManager.cache.put(runState.address, runState.contract)
    runState._vm.runCall(callOptions, parseCallResults)
  }

  function parseCallResults (err, results) {
    // concat the runState.logs
    if (results.vm.logs) {
      runState.logs = runState.logs.concat(results.vm.logs)
    }

    // add gasRefund
    if (results.vm.gasRefund) {
      runState.gasRefund = runState.gasRefund.add(results.vm.gasRefund)
    }

    // this should always be safe
    runState.gasLeft.isub(results.gasUsed)

    if (!results.vm.exceptionError) {
      // save results to memory
      if (results.vm.return) {
        memStore(runState, localOpts.outOffset, results.vm.return, new BN(0), localOpts.outLength, false)
      }

      // update stateRoot on current contract
      runState.stateManager.getAccount(runState.address, function (err, account) {
        runState.contract = account
        // push the created address to the stack
        if (results.createdAddress) {
          cb(err, results.createdAddress)
        } else {
          cb(err, Buffer.from([results.vm.exception]))
        }
      })
    } else {
      // creation failed so don't increament the nonce
      if (results.vm.createdAddress) {
        runState.contract.nonce = new BN(runState.contract.nonce).subn(1)
      }

      cb(err, Buffer.from([results.vm.exception]))
    }
  }
}
