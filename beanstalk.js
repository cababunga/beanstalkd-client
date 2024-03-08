"use strict";

const events = require("node:events");
const net = require("node:net");

const DEFAULT_PRIORITY = 1<<16;

const CRLF = Buffer.from("\r\n");

class Beanstalk extends events.EventEmitter {
    static connect({
        host="localhost",
        port=11300,
        parseYaml=null,
        delay=10,
        maxDelay=5000,
        logger=null,
    }={}) {
        const beanstalk = new Beanstalk(parseYaml, logger);
        beanstalk.on("connect", () => logger && logger("Connected to beanstalkd"));
        return beanstalk.connect(host, port, delay, maxDelay);
    }

    // These tree response types return payload, only one of them has payload serialized as YAML
    static yamlBody = {
        RESERVED: false,
        FOUND: false,
        OK: true,
    };

    constructor(parseYaml, logger) {
        super();

        this.stream = null;
        this.handlers = [];
        this.buffer = Buffer.alloc(0);
        this.parseYaml = parseYaml;

        this.log = logger
        this.reconnect = true;
    }

    async _connect(host, port) {
        this.stream = net.connect(port, host);

        await new Promise((resolve, reject) => {
            this.stream.on("connect", () => { this.emit("connect"); resolve(); });
            this.stream.once("error", reject);
            this.stream.on("close", err => {
                this.emit("close", err);
                for (const {expect, resolve, reject} of this.handlers)
                    expect == "" ? resolve() : reject(new Error("Beanstalk closed connection"));
                this.handlers = [];
                this.stream = null;
            });
        });

        this.stream.on("data", this.onData.bind(this));

        return this;
    }

    async connect(host, port, delay, maxDelay) {
        const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));
        
        while (this.reconnect) {
            try {
                await this._connect(host, port);
                break;
            }
            catch (e) {
                if (delay < 0)
                    throw e;

                delay = delay * 2 > maxDelay ? maxDelay : delay * 2;
                if (this.log)
                    this.log(`Can't connect to beanstalkd: ${e}. Sleeping for ${delay / 1000} s`);
                await sleep(delay);
            }
        }
        this.once("close", async () => {
            if (this.log)
                this.log("Disconnected from beanstalkd");
            await this.connect(host, port, delay);
        });

        return this;
    }

    async disconnect() {
        this.reconnect = false;
        await this.quit();
        if (this.stream)
            this.stream.end();
    }

    onData(data) {
        this.buffer = Buffer.concat([this.buffer, data]);

        while (true) {
            // Header is everything up to the first \r\n
            const data = this.buffer;
            const headerEnd = data.indexOf(CRLF);
            if (headerEnd < 0)
                return;

            const header = data.toString("utf8", 0, headerEnd);
            const args = header.split(" ");
            const response = args.shift();
            let body = null;
            let responseSize = headerEnd + 2;
            if (response in Beanstalk.yamlBody) {
                // Body is args[-1] bytes after header + 2 bytes separator
                const bodyStart = headerEnd + 2;
                const bytes = args.pop() | 0;
                const bodyEnd = bodyStart + bytes;
                if (data.length < bodyEnd + 2)
                    return;

                body = data.subarray(bodyStart, bodyEnd);
                if (Beanstalk.yamlBody[response] && this.parseYaml)
                    args.push(this.parseYaml(body.toString()));
                else
                    args.push(body);

                responseSize = bodyEnd + 2;
            }
            this.buffer = Buffer.from(data.subarray(responseSize));
            // Here we have a complete response

            const {expect, resolve, reject} = this.handlers.shift();

            if (response != expect) {
                reject(new Error(response));
                continue;
            }

            if (args.length == 0)
                resolve();
            else if (args.length == 1)
                resolve(args[0]);
            else
                resolve(args);

            continue;
        }
    }

    // Custom commands
    put(data, {priority=DEFAULT_PRIORITY, delay=0, ttr=60}={}) {
        const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const commandline = ["put", priority, delay, ttr | 0, payload.length].join(" ");
        const buffer = Buffer.concat([Buffer.from(commandline), CRLF, payload, CRLF]);
        this.stream.write(buffer);

        return new Promise((resolve, reject) =>
            this.handlers.push({expect: "INSERTED", resolve, reject}));
    }

    release(id, {priority=DEFAULT_PRIORITY, delay=0}={}) {
        const commandline = ["release", id, priority, delay].join(" ");
        const buffer = Buffer.from(commandline + "\r\n");
        this.stream.write(buffer);

        return new Promise((resolve, reject) =>
            this.handlers.push({expect: "RELEASED", resolve, reject}));
    }

    bury(id, {priority=DEFAULT_PRIORITY}={}) {
        const commandline = ["bury", id, priority].join(" ");
        const buffer = Buffer.from(commandline + "\r\n");
        this.stream.write(buffer);

        return new Promise((resolve, reject) =>
            this.handlers.push({expect: "BURIED", resolve, reject}));
    }

    // This will call reserve-with-timeout if timeout is provided, otherwise will call reserve
    reserve(timeout) {
        const commandLine = timeout == undefined
                          ? "reserve\r\n"
                          : `reserve-with-timeout ${timeout}\r\n`;
        this.stream.write(commandLine);

        return new Promise((resolve, reject) =>
            this.handlers.push({expect: "RESERVED", resolve, reject}));
    }
}


// Generic commands
const commands = [
    ["use", "USING"],
    ["watch", "WATCHING"],
    ["ignore", "WATCHING"],
    ["delete", "DELETED"],
    ["touch", "TOUCHED"],
    ["kick", "KICKED"],
    ["kick-job", "KICKED"],
    ["reserve-job", "RESERVED"],

    ["peek", "FOUND"],
    ["peek-ready", "FOUND"],
    ["peek-delayed", "FOUND"],
    ["peek-buried", "FOUND"],

    ["list-tube-used", "USING"],
    ["pause-tube", "PAUSED"],

    // The server returns yaml document in response to these commands
    ["stats", "OK"],
    ["stats-tube", "OK"],
    ["stats-job", "OK"],
    ["list-tubes", "OK"],
    ["list-tubes-watched", "OK"],
    
    // Closes the connection, no response
    ["quit", ""],
];

const makeCommand = (command, expect) => {
    // Generic commands are called as client.COMMAND(arg1, arg2, ...);
    // They're sent to beanstalkd as: COMMAND arg1 arg2 ...
    return function (...args) {
        args.unshift(command);

        const buffer = Buffer.from(args.join(" ") + "\r\n");
        this.stream.write(buffer);

        return new Promise((resolve, reject) =>
            this.handlers.push({expect, resolve, reject}));
    };
}

const toCamelCase = str => str.replace(/-\w/g, c => c.slice(1).toUpperCase());

for (const [command, response] of commands) {
    const methodName = toCamelCase(command);
    Beanstalk.prototype[methodName] = makeCommand(command, response);
}


module.exports = Beanstalk;

