const {logError} = require('thread.utils');

class Runner {

	constructor() {
		this.active = [];
		this.suspended = [];
		this.time = Game.time - 1;
		this.resumeTime = Infinity;
		this.startIndex = 0;
	}

	queue(thread) {
		this.active.push(thread, thread.v);
	}

	schedule(resumeTime, thread) {
		if (this.time >= resumeTime) {
			return;
		}
		const length = this.suspended.length;
		let i = 0;
		while (i < length) {
			const time = this.suspended[i];
			if (time > resumeTime) {
				break;
			}
			i += 3;
		}
		this.suspended.splice(i, 0, resumeTime, thread, thread.v);
		if (i === 0) {
			this.resumeTime = resumeTime;
		}
	}

	resumeSuspended() {
		const length = this.suspended.length;
		let i = 0, resumeTime = Infinity;
		while (i < length) {
			const time = this.suspended[i];
			const thread = this.suspended[i + 1];
			const v = this.suspended[i + 2];
			if (thread.v === v) {
				if (time > this.time) {
					resumeTime = time;
					break;
				}
				thread.resume();
			}
			i += 3;
		}
		this.suspended.splice(0, i);
		this.resumeTime = resumeTime;
	}

	tick() {
		this.time = Game.time;
		if (this.time >= this.resumeTime) {
			this.resumeSuspended();
		}
		
		if (this.startIndex > 0) {
			const thread = this.active[this.startIndex];
			thread.afterTimeout();
		}

		const length = this.active.length;
		for (let i = this.startIndex; i < length; i += 2) {
			const thread = this.active[i];
			const v = this.active[i + 1];
			if (thread.v === v) {
				let running, k = 0;
				do {
					k++;
					if (k > thread.maxTickExecutions) {
						logError(new Error('RECURSION!!'));
						thread.log();
						break;
					}
					running = thread.tick();
				} while (running && thread.continued);
				if (running && thread.v === v) {
					this.active.push(thread, thread.v);
				}
			}
			this.startIndex += 2;
		}

		this.active.splice(0, length);
		this.startIndex = 0;
	}

}

// Uncomment this line to register Runner in global namespace:
// global.Runner = Runner;

module.exports = Runner;
