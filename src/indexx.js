var chainAPI = require('datdot-chain') // to use substrate node
var sign = require('datdot-chain/signer') // to use substrate node
var serviceAPI = require('datdot-service') // to use dat stuff

// ROLES:
// 1. `REQUESTER` ACCOUNT
// 2. `HOSTER` ACCOUNT
// 3. `ENCODER` ACCOUNT

// A. SIGNUP FLOW

// 1. `make ACCOUNT`
var myAccount = await chainAPI.makeAccount()
console.log(myAccount) // => { ID, ... }
// var status = await chainAPI.status(myAccountId)
// console.log(`my current status: ${status}`)

// B. COMMIT FLOW

// ----------------------------------------------------------------------------
// 1a. `request HOSTING`
// @NOTE: requesting HOSTING is "opt in"
const opts = {
  backing: '0', // e.g. `0-100%` and/or hypercore "chunk ranges"
  address: hypercore.key
}
const signature = sign(opts, myAccount)
chainAPI.offerBacking(opts, signature, handleBacking)
function handleBacking (event) {
  const handle = {
    success : event => console.log(`done! => dashboard update: ${event} ${hypercore.key} ${myAccount} ${opts}`),
    fail    : event => console.error('oops, something went wrong', event)
    request : event => { /* @TODO: handle backing requests */ }
  }
  return (handle[event.type] || handle.fail)(event)
}

// ----------------------------------------------------------------------------
// 1b. `offer ENCODING`
// @NOTE: offering ENCODING is "opt out"
// => every account offers encoding by default
const opts = {}
chainAPI.offerEncoding(opts, signature, protocolEncoding)
// @LATER:
// chainAPI.abortEncoding(myAccountId) // start again with `.offerEncoding`
// chainAPI.pauseEncoding(myAccountId) // resume with `.offerEncoding`
function protocolEncoding (event) {
  const handle = {
    success : event => console.log('done'),
    fail    : event => console.error('oops, something went wrong', event),
    encode  : event => handleEncoding(event)
  }
  return (handle[event.type] || handle.fail)(event)
}

// ----------------------------------------------------------------------------
// 1c. `offer HOSTING`
// @NOTE: offering HOSTING is "opt in"
const opts = {}
chainAPI.offerHosting(opts, signature, protocolHosting)
// @LATER:
// chainAPI.abortHosting(myAccountId) // start again with `.offerHosting`
// chainAPI.pauseHosting(myAccountId) // resume with `.offerHosting`
function protocolHosting (event) {
  const handle = {
    success : event => console.log('done'),
    fail    : event => console.error('oops, something went wrong', event),
    hosting : event => handleHosting(event)
  }
  return (handle[event.type] || handle.fail)(event)
}


// ----------------------------------------------------------------------------
// 2a. `handle ENCODING`

/*
const search = (event, find) => find(event)
const dig = (event, find) => find(event)

const query = { path, scan }

const query = { path, probe }

const query = { path, quest }

const query = { path, study }

const query = { path, inspect }

const query = { path, seek }

const query = { path, study }

claim
assert
test
verify

question
ask
request
give

response
reply

seek
inquiry
probe
quiz

challenge
check

poke
sift
inquest
audit
call


*/
function handleEncoding (event) {
  var { signer: hosterID, feed: address } = event

  const scan = ({ signer, feed }, done) => signer === hosterID && feed === address ? done(event) : void 0
  const query = { type: 'hosting', scan }
  const query = ['hosting', scan]
  const off = chainAPI.on(['hosting', query], event => {
    var { AccountId, feedKey: feedID } = event
    if (AccountId === hosterID && feedID === feedKey) { // if hoster is ready
      cleanup() // deletes original and encoded data (from memory/disk)
      chainAPI.offHosting(feedKey) // @NOTE: stop listening
    }
  })
  off.then()

  var swarmE = hyperswarm()
  var feedE = hypercore() // @NOTE: use memory
  // @TODO: optimize, by not storing on disk, but forwarding directly
  var swarm = hyperswarm()
  var feed = hypercore(feedKey) // @NOTE: use memory

  feed.on('ready', () => feedE.on('ready', () => start()))

  function start () {
    swarmE.join(hosterID, { announce: true })
    swarmE.on('connection', s => s.pipe(feedE.replicate(false)).pipe(s))
    swarm.join(feed.key, { lookup: true })
    swarm.on('connection', s => s.pipe(feed.replicate(true)).pipe(s))

    feed.createReadStream().on('data', chunk => {
      compress(chunk, (err, chunkE) => feedE.append(chunkE)
    }).on('end', () => {
      // @TODO: notify the chain (done(encodedMerkleRoot))
      var merkleRootE = feedE.getMerkleRoot()
      chainAPI.commit(myAccountId, event, merkleRootE)
    })
  }
}


// ----------------------------------------------------------------------------
// 2b. `handle HOSTING`
function handleHosting (event) {
  var { encoderID, feedKey } = event

  chainAPI.onHosting(feedKey, event => {
    var { AccountId, feedKey: feedID } = event
    if (AccountId === hosterID && feedID === feedKey) {
      cleanup() // close and delete `swarmE` and `feedE`
      chainAPI.offHosting(feedKey) // @NOTE: stop listening
    }
  })

  var swarmE = hyperswarm()
  var feedE = hypercore(encoderID) // @NOTE: use memory

  var swarm = hyperswarm()
  var feed = hypercore(feedKey) // @NOTE: use disk

  feed.on('ready', () => feedE.on('ready', () => start()))

  function start () {
    swarmE.join(feedE.key, { lookup: true })
    swarmE.on('connection', s => s.pipe(feedE.replicate(true)).pipe(s))
    swarm.join(feed.key, { announce: true })
    swarm.on('connection', s => s.pipe(feed.replicate(true)).pipe(s))

    feedE.createReadStream().on('data', chunkE => {
      decompress(chunkE, (err, chunk) => feed.append(chunk)
    }).on('end', () => {
      var merkleRootE = feedE.getMerkleRoot()
      chainAPI.commit(myAccountId, event, merkleRootE)
    })
  }
}


// ----------------------------------------------------------------------------
// 2. SERVE
// `@TODO` implement challenge process for attesters
