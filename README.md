Lightweight generator based threads solution for screeps game

# Installation

Copy `runner.js`, `thread.js` and `thread.utils.js` into your screeps brunch directory.

# Usage

## Creating Runner and Threads
```js
const Runner = require('runner');
const Thread = require('thread');

const creepsRunner = new Runner();

const thread1 = new Thread(creepsRunner, function() * {
	console.log('thread1 started');
	yield; // skip to next tick
	console.log('thread1 finished');
});

const thread2 = new Thread(creepsRunner, function() * {
	console.log('thread2 started');
	yield; // skip to next tick
	console.log('thread2 finished');
}, false);
// Specifying 3rd argument as "false" will start thread in "CREATED" (suspended) mode.
// later need to call thread.start(); or thread.restart();

module.exports.loop = function() {
	creepsRunner.tick();
};
```

You can create multiple runners to control the order of execution for different thread types.

```js
const roomsRunner = new Runner();
const creepsRunner = new Runner();

module.exports.loop = function() {
	roomsRunner.tick(); // Need to run "tick" for each runner
	creepsRunner.tick();
};
```

Also you can register runners in global so you can easy access them in other modules.

```js
global.RoomsRunner = new Runner();

// in other module
const thread = new Thread(RoomsRunner, function(thread) * { /* ... */ });
```

Thread instance will be provided by first agrument of the generator function. Which is optional, you can ommit it if not going to use.

Note: Remember that global reset (it happends everytime you upload new code or server restart your IVM instance) will clear all threads and their data. You can save some data in memory that will help to reinstantiate threads.

## Using class method as thread generator function

In that case you will need to use `bind(this)`.

```js
class RoomManager {

	constructor(room) {
		this.room = room;
		this.roomName = room.name;
		this.loadTime = Game.time;
		this.towersId = [];
		this.updateStructures = new Thread(RoomsRunner, this.updateStructures.bind(this));
		this.towersThread = new Thread(RoomsRunner, this.runTowers.bind(this), false); // "false" means don't automatically start the thread
	}
	
	load() {
		if (Game.time !== this.loadTime) {
			this.room = Game.rooms[this.roomName];
			this.loadTime = Game.time;
		}
		return this.room;
	}
	
	getTowers() {
		return this.towersId
			.map(id => Game.getObjectById(id))
			.filter(tower => !!tower);
	}
	
	* updateStructures(thread) {
		if (!this.load()) {
			return null; // No vision for room
		}
		
		this.towersId = room.find(FIND_MY_STRUCTURES, {
			filter: s => s.structureType === STRUCTURE_TOWER
		}).map(tower => tower.id);
		
		if (this.towersId.length > 0 && !this.towersThread.isRunning) {
			this.towersThread.restart(); // restart towers thread if it wasn't already running
		}
		
		yield thread.restart(20); // restart thread after 20 ticks
	}
	
	* runTowers(thread) {
		if (!this.load()) {
			return null; // No vision for room, finish the thread
		}
		
		const towers = this.getTowers(room);
		if (towers.length === 0) {
			return null; // No towers, finish the thread
		}
		
		const hostiles = room.find(FIND_HOSTILE_CREEPS);
		if (hostiles.length > 0) {
			// ... shooting code
		}
		
		yield thread.restart(); // repeat this fucntion from very beginning in the next tick
	}

}
```

## Thread states

Thread states cab be:
* `CREATED` Thread will be in this state after creation and if 3rd argument (automatically run thread) was "false"
* `RUNNING` Active thread state, will continue to run in each tick while generator function not finished and executes `yield;` statement
* `SUSPENDED` Thread was suspended and will not run automatically, but it preserves it's internal postion (line where last `yield` was occured)
* `FINISHED` Thread is finished. If generator function came to it's end thread will be finished automatically. Or if you `return null;` from main generator function

There are boolean getter properties `isRunning`, `isFinished` and `isSuspended` to check thread's current state.


## Thread methods

If thread is not in one of allowed state when one of these method is called, thread state will not be changed.

### `start()`
Starts thread. Changes it's state to `RUNNING`.
Thread gets added to runner's active queue.

Allowed states: `CREATED`, `RUNNING`


### `finish()`
Finishes thread. Changes it's state to `FINISHED`.
All thread references in runner's queue and suspened queue created before that call will be removed.

Allowed states: `CREATED`, `RUNNING`, `SUSPENED`, `FINISHED`


### `restart(delay = 0)`
Restarts thread. Which means resets generator function internal postion to the very begining.
All thread references in runner's queue and suspened queue created before that call will be removed.
Supports restarting finished (`FINISHED` state) threads.

Note: If generator is not a function but an iterable instance (like a class with defined property `[Symbol.iterator]`) there will be error "Thread restarting only allowed when generator is a function". And thread will be finished (`FINISHED` state)

If delay is 0: (immediate restart)
> Changes it's state to `RUNNING`.

If delay is > 0: (delayed restart)
> Changes it's state to `SUSPENDED`.
> Thread gets added to runner's suspended queue, which will resume execution (but from begginning of the generator function) as soon as required `Game.time` will come

IF delay is Infinity: (restart with suspend)
> Changes it's state to `SUSPENDED`.
> But will not add thread to runner's suspened queue. (Will need to resume the thread by calling `resume()` or `restart()`)

Allowed states: `CREATED`, `RUNNING`, `SUSPENDED`, `FINISHED`


### `restartSuspended()`
Shorthand for `restart(Infinity)`. Restarts thread. Resets generator function internal postion to the very begining.
All thread references in runner's queue and suspened queue created before that call will be removed.
Later need to call `resume()` or `restart()` to resume execution.

Allowed states: `CREATED`, `RUNNING`, `SUSPENDED`, `FINISHED`


### `suspend()`
Suspends the thread. Changes it's state to `SUSPENDED`.
All thread references in runner's queue and suspened queue created before that call will be removed.
Later need to call `resume()` or `restart()` to resume execution.
Only takes effect if curent thread state is `RUNNING`.

Allowed states: `RUNNING`


### `schedule(time)`
Resumes the thread. Changes it's state to `SUSPENDED`.
All thread references in runner's queue and suspened queue created before that call will be removed.
Thread gets added to runner's suspended queue, which will resume execution as soon as required `Game.time` will come.
Internal generator position is preserved.

Note: `runner.time` is updated to `Game.time` only at the biginning of `runner.tick()`, so better not to use `schedule(Game.time + delay)` if you are calling it before `runner.tick()`.

Allowed states: `RUNNING`, `SUSPENED`


### `sleep(delay)`
Suspends the thread. Changes it's state to `SUSPENDED`. Alias of `schedule(runner.time + delay)`
All thread references in runner's queue and suspened queue created before that call will be removed.
Thread gets added to runner's suspended queue, which will resume execution as soon as required `Game.time` will come.
Internal generator position is preserved.
`delay` should not be negative.
Only takes effect if curent thread state is `RUNNING`.

Allowed states: `RUNNING`


### `resume()`
Resumes the thread. Changes it's state to `RUNNING`.
All thread references in runner's queue and suspened queue created before that call will be removed.
Thread gets added to runner's active queue.
If current state is `CREATED` acts like `start()` method

Allowed states: `CREATED`, `SUSPENDED`


### `continue()`
Toggles internal `continued` variable to true. Runner will repeat thread's `tick()` method many times if this variable will remain to be `true`.
`continued` is reset to `false` at the beginnng of the thread's `tick()` method. Means you need to call `continue()` before the ending of each thead's tick iteration to remain.
Also there is a built-in protection from recursion.
Only takes effect if curent thread state is `RUNNING`.

Allowed states: `RUNNING`


### `tick()`

Runs a single iteration of generator (from last `yield` to next `yield` statement)


## Extending Thread class

You can extend Thread class. By default if no generator fucntion provided for 2nd construcor argument it uses own "run" method (which is empty for base Thread class)

```js
class SpawnThread extends Thread {

	constructor(roomManager) {
		super(RoomsRunner);
		this.room = roomManager;
	}

	* run() {
		let continueSpawning = false;
		
		const spawns = this.room.getSpawns();
		const idleSpawns = spawns.filter(spawn => !spawn.spawning);
		let continueSpawning = false;
		for (const requirement of this.room.getCreepRequirements()) {
			const currentCount = this.room.getCreepsCount(requirement.creepType);
			let remainingCount = requirement.count - currentCount;
			if (remainingCount <= 0) {
				continue;
			}
			while (remainingCount > 0) {
				if (this.room.trySpawnCreep(creepType, spawn) !== OK) {
					break;
				}
				remainingCount--;
				idleSpawns.pop();
				if (idleSpawns.length === 0) {
					break;
				}
			}
			if (remainingCount > 0) {
				continueSpawning = true;
				break;
			}
		}
		
		if (continueSpawning) {
			if (idleSpawns.length === 0) {
				const minRemainingTime = _.min(spawns, spawn => (
					spawn.spawning ? spawn.spawning.remainingTime : 0
				));
				if (minRemainingTime < Infinity) {
					yield this.restart(minRemainingTime);
				}
			}
			yield this.restart();
		}
	}

}
```

You can override methods to add additional logic.

```js
class CreepThread extends Thread {

	constructor(creepEntity) {
		super(CreepsRunner, creepEntity.run.bind(creepEntity), false); // you can specify other method instead of own Thread "run"
		this.creep = creepEntity;
	}

	tick() {
		// modifying tick method
		// allows to run code for each tick if thead is active
		if (!this.creep.load()) {
			super.finish();
			return false;
		}
		return super.tick(); // don't forget to call tick method of parent class
	}

	finish(continueThread = false) {
	 	// in this case reaching the end of task's generator function will not finish the thread
		// but will cause searching new task for creep
		this.creep.taskFinished(continueThread);
	}

}

class CreepEntity {

	constructor(creep) {
		this.name = creep.name;
		this.creep = creep;
		this.memory = Memory.creeps[creep.name];
		
		this.task = undefined;
		this.isDead = false;
		
		this.thread = new CreepThread(this);
	}
	
	static cleanMemory(name) {
		delete Memory.creeps[name];
	}
	
	load() {
		this.creep = Game.creeps[this.name];
		if (!this.creep && !this.isDead) {
			this.isDead = true;
			CreepEntity.cleanMemory(this.name);
		}
		return this.creep;
	}
	
	* run() {
		yield * this.task.run(this);
	}
	
	setTask(task) {
		this.task = task;
		this.memory.task = task.type;
		this.thread.restart();
	}
	
	taskFinished(continueThread = false) {
		const task = this.findTask();
		if (task) {
			this.setTask(task);
			if (continueThread) {
				this.thread.continue();
			}
		} else {
			this.task = undefined;
			this.memory.task = undefined;
			this.thread.suspend();
		}
	}

}
```

## Multiple globals

Sometimes screeps server runs older version of your global, that store older version of runners and threads in heap.
For example if you created a thread for creep and after creep was dead your previous runner finished the thread, but older version still have instance of thread for that creep in `RUNNING` (sctive) state.

If your threads state depend on game objects or game events, better to create new runners and reinstantiate all threads if you detect multiple globals.

```js
let creepsRunner;

function instantiateThreads() {
	creepsRunner = new Runner();
	// ...
}


let globalIndex = Memory.globalIndex = (Memory.globalIndex || 0) + 1;
Memory.lastGlobalIndex = globalIndex;

function checkGlobal() {
	if (globalIndex !== Memory.lastGlobalIndex) {
		console.log('Multiple globals');
		Memory.lastGlobalIndex = globalIndex;
		instantiateThreads();
	}
}


instantiateThreads(); // instantiating normally

module.exports.loop = function() {
	checkGlobal();
	creepsRunner.tick();
};
```
