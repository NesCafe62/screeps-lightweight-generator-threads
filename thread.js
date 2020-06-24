const {logError} = require('thread.utils');

const STATE_CREATED = 0;
const STATE_RUNNING = 1;
const STATE_SUSPENDED = 2;
const STATE_FINISHED = 3;

class ThreadHandler {

	constructor(thread, gen = undefined) {
		this.gen = gen;
		if (typeof gen === 'function') {
			this.makeGen = () => gen(thread);
			this.tick = this._init;
		} else {
			this.gen = gen;
			this.tick = this._tick;
		}
	}

	_init() {
		this.gen = this.makeGen();
		this.tick = this._tick;
		return this.gen.next();
	}

	_tick() {
		return this.gen.next();
	}

	reset() {
		if (this.makeGen) {
			this.tick = this._init;
			return true;
		}
	}

}

class Thread {

	constructor(runner, gen = undefined, start = true) {
		this.runner = runner;
		this.handler = new ThreadHandler(this, gen || this.run.bind(this));
		this.continued = false;
		this.v = 0;
		this.state = STATE_CREATED;
		if (start) {
			this.runner.queue(this);
			this.state = STATE_RUNNING;
		}
	}

	* run() { }
	
	log() {
		console.log(this.constructor.name);
	}

	get isRunning() {
		return this.state === STATE_RUNNING;
	}

	get isFinished() {
		return this.state === STATE_FINISHED;
	}

	get isSuspended() {
		return this.state === STATE_SUSPENDED;
	}

	start() {
		if (this.state !== STATE_CREATED) {
			return;
		}
		this.runner.queue(this);
		this.state = STATE_RUNNING;
	}

	finish() {
		if (this.state === STATE_FINISHED) {
			return;
		}
		this.v++;
		this.state = STATE_FINISHED;
	}

	restart(delay = 0) {
		if (this.state !== STATE_CREATED) {
			this.v++;
			this.state = STATE_CREATED;
			if (!this.handler.reset()) {
				logError(new Error('Thread restarting only allowed when generator is a function'));
				this.state = STATE_FINISHED;
				return;
			}
		}

		if (delay > 0) {
			if (delay !== Infinity) {
				this.runner.schedule(this.runner.time + delay, this);
			}
			this.state = STATE_SUSPENDED;
		} else {
			this.runner.queue(this);
			this.state = STATE_RUNNING;
		}
	}

	restartSuspended() {
		this.restart(Infinity);
	}

	suspend() {
		if (this.state !== STATE_RUNNING) {
			return;
		}
		this.v++;
		this.state = STATE_SUSPENDED;
	}

	schedule(time) {
		if (this.state === STATE_SUSPENDED) {
			this.v++;
		} else if (this.state === STATE_CREATED) {
			return;
		}
		this.runner.schedule(time, this);
		this.state = STATE_SUSPENDED;
	}

	sleep(delay) {
		if (this.state !== STATE_RUNNING) {
			return;
		}
		if (delay <= 0) {
			logError(new Error('Thread sleep delay must be grater than zero'));
			return;
		}
		this.v++;
		this.runner.schedule(this.runner.time + delay, this);
		this.state = STATE_SUSPENDED;
	}

	resume() {
		if (this.state === STATE_SUSPENDED) {
			this.v++;
		} else if (this.state !== STATE_CREATED) {
			return;
		}
		this.runner.queue(this);
		this.state = STATE_RUNNING;
	}

	continue() {
		if (this.state !== STATE_RUNNING) {
			return;
		}
		this.continued = true;
	}

	tick() {
		try {
			this.continued = false;
			const {done} = this.handler.tick();
			if (done) {
				this.finish();
			}
		} catch (error) {
			logError(error);
		}
		return this.state === STATE_RUNNING;
	}

}

// global.Thread = Thread; // Uncomment this line to register in gloal namespace

module.exports = Thread;