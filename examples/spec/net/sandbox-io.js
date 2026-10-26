/**
 * Tracked fakes of the sandbox's non-D endowments for the robustness net: setTimeout, net, dgram.
 *
 * Production endows the real Node `setTimeout`, `node:net` and `node:dgram`
 * (remote_pawn_ng src/sandbox/sandbox.js). Their callbacks are NOT wrapped there: a throw
 * from a timer or a socket event is an uncaughtException that kills the sandbox. Here every
 * callback goes through `deliver(fn, where)`, which the runner tracks for idle detection and
 * runs under try/catch, recording a throw as a crash at `where`.
 *
 * Sockets take their behaviour from the scenario responder, as one transport call
 * `{ kind: "tcp", method: "net.createConnection" | "dgram.send", options }` with the ssh-family
 * reply shape `[output, error]`: error set -> "error" then "close"; otherwise "connect",
 * "data" (only when the output is non-empty, as Node never emits empty data), "end", "close".
 * An "error" with no listener throws out of emit(), exactly as Node does, so it is a crash.
 */

const { EventEmitter } = require("events");
const nodeNet = require("net");

const PASSTHROUGH = new Set(["then", "toJSON", "inspect", "constructor", "domain"]);
const MAX_TIMER_DELAY_MS = 10;

function strict(target, path, unknownMembers) {
    return new Proxy(target, {
        get(obj, prop, receiver) {
            if (typeof prop === "symbol" || PASSTHROUGH.has(prop) || prop in obj) {
                return Reflect.get(obj, prop, receiver);
            }
            const name = path + "." + prop;
            unknownMembers.push(name);
            throw new Error("fake sandbox has no member " + name);
        }
    });
}

function toError(value) {
    if (value instanceof Error) {
        return value;
    }
    const error = new Error((value && value.message) || String(value));
    if (value && value.code !== undefined) {
        error.code = value.code;
    }
    return error;
}

function toBuffer(output) {
    return Buffer.isBuffer(output) ? output : Buffer.from(String(output));
}

const isEmpty = (output) => output === undefined || output === null || output === "" || (Buffer.isBuffer(output) && output.length === 0);

class FakeSocket extends EventEmitter {
    constructor(deliver, host, port) {
        super();
        this._deliver = deliver;
        this._encoding = null;
        this.destroyed = false;
        this.writableEnded = false;
        this.closed = false;
        this.remoteAddress = host;
        this.remotePort = port;
        this.writes = [];
    }

    _emitLater(event, ...args) {
        this._deliver(() => this.emit(event, ...args), "net." + event);
    }

    _close(hadError) {
        if (!this.closed) {
            this.closed = true;
            this.emit("close", hadError);
        }
    }

    write(data, encoding, callback) {
        const cb = [encoding, callback].find((arg) => typeof arg === "function");
        if (this.writableEnded || this.destroyed) {
            const error = new Error("write after end");
            error.code = "ERR_STREAM_WRITE_AFTER_END";
            this._emitLater("error", error);
            if (cb) {
                this._deliver(() => cb(error), "net.write");
            }
            return false;
        }
        this.writes.push(data);
        if (cb) {
            this._deliver(() => cb(), "net.write");
        }
        return true;
    }

    end(data, encoding, callback) {
        const cb = [data, encoding, callback].find((arg) => typeof arg === "function");
        if (data !== undefined && typeof data !== "function" && !this.writableEnded) {
            this.write(data, typeof encoding === "string" ? encoding : undefined);
        }
        this.writableEnded = true;
        if (cb) {
            this._deliver(() => cb(), "net.end");
        }
        return this;
    }

    destroy(error) {
        if (!this.destroyed) {
            this.destroyed = true;
            this.writableEnded = true;
            if (error) {
                this._emitLater("error", error);
            }
            this._deliver(() => this._close(Boolean(error)), "net.close");
        }
        return this;
    }

    setTimeout(ms, callback) {
        // The fake always ends with "close", so the inactivity timeout never fires.
        if (typeof callback === "function") {
            this.once("timeout", callback);
        }
        return this;
    }

    setEncoding(encoding) {
        this._encoding = encoding || "utf8";
        return this;
    }

    setNoDelay() {
        return this;
    }

    setKeepAlive() {
        return this;
    }

    ref() {
        return this;
    }

    unref() {
        return this;
    }
}

// Runs the remote side of one connection: each event is delivered in its own turn and the next
// one is queued only after it ran, so handlers attached in between still see later events.
function playConnection(socket, deliver, reply) {
    const output = reply[0];
    const error = reply[1];
    const steps = [];
    if (error !== undefined && error !== null) {
        steps.push(["error", () => socket.emit("error", toError(error))]);
        steps.push(["close", () => socket._close(true)]);
    } else {
        steps.push(["connect", () => socket.emit("connect")]);
        if (!isEmpty(output)) {
            steps.push(["data", () => {
                const buffer = toBuffer(output);
                socket.emit("data", socket._encoding ? buffer.toString(socket._encoding) : buffer);
            }]);
        }
        steps.push(["end", () => {
            // allowHalfOpen is false by default: the remote end also ends our writable side.
            socket.writableEnded = true;
            socket.emit("end");
        }]);
        steps.push(["close", () => socket._close(false)]);
    }
    const next = (i) => {
        if (i >= steps.length) {
            return;
        }
        const [event, run] = steps[i];
        deliver(() => {
            if (socket.closed || (socket.destroyed && event !== "close")) {
                return;
            }
            try {
                run();
            } finally {
                next(i + 1);
            }
        }, "net." + event);
    };
    next(0);
}

function createNet(ctx) {
    function createConnection(...args) {
        ctx.record.transportCalls++;
        const options = args[0];
        const host = options && typeof options === "object" ? options.host : args.find((a) => typeof a === "string");
        const port = options && typeof options === "object" ? options.port : options;
        const listener = args.find((arg) => typeof arg === "function");
        const socket = new FakeSocket(ctx.deliver, host, port);
        if (listener) {
            socket.once("connect", listener);
        }
        const reply = ctx.responder({ kind: "tcp", method: "net.createConnection", options });
        if (Array.isArray(reply)) {
            playConnection(socket, ctx.deliver, reply);
        }
        return strict(socket, "net.Socket", ctx.record.unknownMembers);
    }
    return strict(
        {
            createConnection,
            connect: createConnection,
            isIP: nodeNet.isIP,
            isIPv4: nodeNet.isIPv4,
            isIPv6: nodeNet.isIPv6
        },
        "net",
        ctx.record.unknownMembers
    );
}

class FakeDgramSocket extends EventEmitter {
    constructor(ctx) {
        super();
        this._ctx = ctx;
        this.closed = false;
    }

    _emitLater(event, ...args) {
        this._ctx.deliver(() => this.emit(event, ...args), "dgram." + event);
    }

    bind(...args) {
        const cb = args.find((arg) => typeof arg === "function");
        if (cb) {
            this.once("listening", cb);
        }
        this._emitLater("listening");
        return this;
    }

    send(msg, ...rest) {
        const ctx = this._ctx;
        ctx.record.transportCalls++;
        const cb = rest.find((arg) => typeof arg === "function");
        const reply = ctx.responder({ kind: "tcp", method: "dgram.send", options: { msg, args: rest.filter((arg) => typeof arg !== "function") } });
        if (!Array.isArray(reply)) {
            return;
        }
        const output = reply[0];
        const error = reply[1];
        if (error !== undefined && error !== null) {
            if (cb) {
                ctx.deliver(() => cb(toError(error)), "dgram.send");
            } else {
                this._emitLater("error", toError(error));
            }
            return;
        }
        if (cb) {
            ctx.deliver(() => cb(null, toBuffer(msg).length), "dgram.send");
        }
        if (!isEmpty(output)) {
            this._emitLater("message", toBuffer(output), { address: "192.0.2.10", family: "IPv4", port: 0, size: toBuffer(output).length });
        }
    }

    close(callback) {
        if (typeof callback === "function") {
            this.once("close", callback);
        }
        if (!this.closed) {
            this.closed = true;
            this._emitLater("close");
        }
        return this;
    }

    address() {
        return { address: "0.0.0.0", family: "IPv4", port: 0 };
    }

    setBroadcast() {}

    setTTL() {}

    ref() {
        return this;
    }

    unref() {
        return this;
    }
}

function createDgram(ctx) {
    return strict(
        {
            createSocket(typeOrOptions, messageListener) {
                const socket = new FakeDgramSocket(ctx);
                if (typeof messageListener === "function") {
                    socket.on("message", messageListener);
                }
                return strict(socket, "dgram.Socket", ctx.record.unknownMembers);
            }
        },
        "dgram",
        ctx.record.unknownMembers
    );
}

// setTimeout(fn, delay, ...args) with delays capped so polling drivers finish quickly.
// Production has no clearTimeout endowment, so the handle only needs Node's no-op surface.
function createSetTimeout(ctx) {
    return function setTimeout(fn, delay, ...args) {
        if (typeof fn !== "function") {
            throw new TypeError("The \"callback\" argument must be of type function. Received " + typeof fn);
        }
        const ms = Math.min(Math.max(Number(delay) || 0, 0), MAX_TIMER_DELAY_MS);
        ctx.timer(() => fn(...args), ms);
        const handle = {
            ref: () => handle,
            unref: () => handle,
            hasRef: () => true,
            refresh: () => handle
        };
        return handle;
    };
}

module.exports = { createNet, createDgram, createSetTimeout, MAX_TIMER_DELAY_MS };
