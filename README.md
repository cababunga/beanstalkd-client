# Beanstalkd Client

Node.js beanstalkd client with async/await API, auto-reconnect and zero dependencies.

## Install

    npm i @cababunga/beanstalkd

## Example

```javascript
const assert = require("node:assert").strict;
const Beanstalk = require("@cababunga/beanstalkd");

const bs = await Beanstalk.connect();
await bs.watch("test");
await bs.ignore("default");
await bs.use("test");
await bs.put(JSON.stringify({task: "make coffee"}), {ttr: 600});

const job = await bs.reserve();
const [jobId, payload] = job;
assert.equal(JSON.parse(payload.toString()).task, "make coffee");
await bs.delete(jobId);
```

## beanstalk

Returns a Beanstalk object, a handle to communicate with beanstalkd. It take one optional parameter, which is an options object. Here are the options with their default values:

```javascript
{
    host: "localhost",
    port: 11300,
    parseYaml: null,
    delay: 10,
    maxDelay: 5000,
    logger: null
}
```

**host** and **port** are the endpoint of your beanstalkd.

**parseYaml** is a function that takes YAML document and produces JavaScript object out of it.
You only need to provide it if you are planning to issue beanstalkd commands that return YAML
documents, such as stats, stats-tube, list-tubes, etc. These commands are mostly used in the interactive sessions and rarely in scripts. If you do not provide YAML parser, YAML response will be returned unparsed as a Buffer.

**delay** is an initial delay in milliseconds before new connection attempt is made after failed one. Delay will exponentially increase until it reach *maxDelay* value. A negative value provided for this option will make connection fail instead of attempting to connect again. If an attempt of initial connection failed `connect()` will throw an exception. If connection was lost after successful connect, the connection object will emit "error".

**maxDelay** maximum delay between connection attempts.

**logger** a function that can take a text message generated on successful connection, failed connection and dropped connection.


### beanstalkd API methods

For most of the beanstalkd commands in form of

    COMMAND arg1 arg2 ...

there is a method with signature

    client.COMMAND(arg1, arg2, ...);

Please refer to the beanstalkd wire protocol documentation:
https://github.com/beanstalkd/beanstalkd/blob/master/doc/protocol.txt

Exceptions are:

*reserve-with-timeout* command, which it issued by *reserve* method when you pass it an optional numeric parameter, which is a timeout in seconds.

*put* `client.put(payload, options)` takes payload as string or Buffer and a single options object. Here are the defaults:

```javascript
{
    priority: 65536,
    delay: 0,
    ttr: 60
}
```

*release* `client.release(id, options={}) takes job ID and options object:

```javascript
{
    priority: 65536,
    delay: 0
}
```

*burry* `client.bury(id, options={}) takes job ID and options object:

```javascript
{
    priority: 65536,
}
```

Commands that return no data make methods that return *undefined*.

Commands that return a single item, typically job ID or tube count, will return that single item as a string.

Commands that return more than one item, for example *reserve* returns job ID and payload, will return an array.

