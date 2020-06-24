const {logError} = require('thread.utils');

class Runner {

	constructor() {
		this.active = [];
		this.suspended = [];
		this.time = Game.time - 1;
		this.resumeTime = Infinity;
	}

	queue(thread) {
		this.active.push([thread, thread.v]);
	}

	schedule(resumeTime, thread) {
		if (this.time >= resumeTime) {
			return;
		}
		const length = this.suspended.length;
		let i = 0;
		while (i < length) {
			const [time] = this.suspended[i];
			if (time > resumeTime) {
				break;
			}
			i++;
		}
		this.suspended.splice(i, 0, [resumeTime, thread, thread.v]);
		if (i === 0) {
			this.resumeTime = resumeTime;
		}
	}

	resumeSuspended() {
		const length = this.suspended.length;
		let i = 0, resumeTime = Infinity;
		while (i < length) {
			const [time, thread, v] = this.suspended[i];
			if (thread.v === v) {
				if (time > this.time) {
					resumeTime = time;
					break;
				}
				thread.resume();
			}
			i++;
		}
		this.suspended.splice(0, i);
		this.resumeTime = resumeTime;
	}

	tick() {
		this.time = Game.time;
		if (this.time >= this.resumeTime) {
			this.resumeSuspended();
		}

		const length = this.active.length;
		for (let i = 0; i < length; i++) {
			const [thread, v] = this.active[i];
			if (thread.v === v) {
				let running, k = 0;
				do {
					k++;
					if (k > 5) {
						logError(new Error('RECURSION!!'));
						thread.log();
						break;
					}
					running = thread.tick();
				} while (running && thread.continued);
				if (running && thread.v === v) {
					this.active.push([thread, thread.v]);
				}
			}
		}

		this.active.splice(0, length);
	}

}

// global.Runner = Runner; // Uncomment this line to register in gloal namespace

module.exports = Runner;