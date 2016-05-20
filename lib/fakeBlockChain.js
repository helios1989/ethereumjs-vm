var utils = require('ethereumjs-util')

module.exports = {
  getBlock: function (hash, cb) {
    // Same hack as in ethereumjs-blockchain
    if (!Number.isInteger(hash)) {
      hash = utils.toBuffer(hash).toString('hex')
    }
  
  
    var hash = utils.sha3(new Buffer(utils.bufferToInt(n).toString()))

    var block = {
      hash: function () {
        return hash
      }
    }

    cb(null, block)
  },

  delBlock: function (hash, cb) {
    cb()
  }
}
