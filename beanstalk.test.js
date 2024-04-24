"use strict";

const {beforeEach, test, afterEach} = require("node:test");
const assert = require("node:assert").strict;

const yaml = require("yaml");
const Beanstalk = require("./beanstalk");

let bs;

beforeEach(async () => {
    bs = await Beanstalk.connect({parseYaml: yaml.parse});
    const use = await bs.use("test");
    assert.equal(use, "test");
    const watch = await bs.watch("test");
    assert.equal(watch, "2");
    const ignore = await bs.ignore("default");
    assert.equal(ignore, "1");
});

afterEach(async () => {
    await bs.disconnect();
});

test("put, reserve, delete sanity test", async () => {
    const put1 = await bs.put("test job 1", {ttr:2});
    assert.match(put1, /^\d+$/);
    const put2 = await bs.put("test job 2", {ttr:2});
    assert.match(put2, /^\d+$/);
    while (true) {
        const job = await bs.reserve(0).catch(e => { if (e.message != "TIMED_OUT") throw e; });
        if (!job)
            break;

        const [id, payload] = job;
        assert.match(payload.toString(), /test job \d/);
        const stat = await bs.statsJob(id);
        assert.equal(stat.tube, "test");
        await bs.delete(id);
    }
});

test("parse YAML output", async () => {
    const out = await bs.stats();
    assert.ok(typeof out, "object");
});

