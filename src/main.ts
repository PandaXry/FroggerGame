/*
 * @Description: 
 * @Author: Yaoze Guo
 * @Date: 2022-08-16 21:11:50
 * @LastEditTime: 2022-09-11 21:41:44
 * @LastEditors: Please set LastEditors
 */
import { fromEvent, interval, merge } from 'rxjs'; 
import { map, filter, scan } from 'rxjs/operators';

function frogger() {
  type Key = 'a' | 'w' | 's' | 'd' |'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Space'
  type Event = 'keyup' | 'keydown'
  
  const Constants = {
    CanvasSize: 600,
    jumpSize: 50,
    StartTime: 0,
    numOfDoor: 3,
    doorPrice: 50,
    starPrice: 200,
    allDoorPrice: 500,
    frogWidth: 50,
    carwidth: 50,
    vanWidth: 100,
    wood1Width: 60,
    wood2Width: 110,
    wood3Width: 160,
    doorWidth: 200,
    yRangeOfDoor: [0, 50],
    yRangeOfRiver: [100, 200],
    yRangeOfTraffic: [300, 500]
  } as const

  //Unit size of each objects
  const scale = {
    frogWidth: 50,
    carWidth: 50,
    vanWidth: 100,
    wood1Width: 60,
    wood2Width: 110,
    wood3Width: 160,
    doorWidth: 200
  } as const

  // the frogger game have the following view element types:
  type ViewType = 'frog' | 'wood' | 'car' | 'van' | 'doorO' | 'doorC' | 'skull' | 'star' | 'flag'

  // two types of game state transitions 
  class Tick {
    constructor(public readonly elapsed: number) { }
  }

  class Jump {
    constructor(public readonly direction: [number, number]) { }
  }

  class Restart {
    constructor(public readonly s: State) {}
  }
  
  // gameClock and user interface transitions
  const gameClock = interval(25).pipe(map((elapsed) => new Tick(elapsed))),
    keyObservable = <T>(e: Event, k: Key, result: () => T) =>
      fromEvent<KeyboardEvent>(document, e).pipe(
        filter(({ code }) => code === k),
        filter(({ repeat }) => !repeat),
        map(result)
      ),
  jumpLeft = keyObservable(
      'keyup',
      'ArrowLeft',
      () => new Jump([-1 * Constants.jumpSize, 0])
    ),
  jumpRight = keyObservable(
      'keyup',
      'ArrowRight',
      () => new Jump([1 * Constants.jumpSize, 0])
    ),
  jumpUp = keyObservable(
      'keyup',
      'ArrowUp',
      () => new Jump([0, -1 * Constants.jumpSize])
    ),
  jumpDown = keyObservable(
      'keyup',
      'ArrowDown',
      () => new Jump([0, 1 * Constants.jumpSize])
    ),
  restartGame = keyObservable(
      'keyup',
      'Space',
      () => new Jump([0, 1 * Constants.jumpSize])
    );

  type Rectangle = Readonly<{pos: Vec; width: number; height: number; disp: Vec}>;
  type ObjectId = Readonly<{ id: string; createTime: number }>;
  interface Ibody extends Rectangle, ObjectId {
    viewType: ViewType;
  };

  // Every objects is a Body in the frogger
  type Body = Readonly<Ibody>;

  //Game state
  type State = Readonly<{
    time: number;
    frog: Body;
    score: number;
    extraLife: number;
    rounds: number;
    numOfStars: number;
    initialSpeed: number;
    riverSec: ReadonlyArray<ReadonlyArray<Body>>;
    trafficSec: ReadonlyArray<ReadonlyArray<Body>>;
    doorSec: ReadonlyArray<ReadonlyArray<Body>>;
    doorSuccess: ReadonlyArray<Body>;
    gameEnd: boolean;
  }>

  // create frog
  function createFrog(): Body{
    return {
      id: 'frog',
      viewType: 'frog',
      pos: new Vec(Constants.CanvasSize / 2 - scale.frogWidth, Constants.CanvasSize - 50),
      width: scale.frogWidth,
      height: scale.frogWidth,
      disp: new Vec(0,0),
      createTime: 0,
    }
  }

  // car/van, wood, door, skull are all rectangle objects
  const createRectangle = (viewType: ViewType) => (oid: ObjectId) => (xCord: number, yCord: number, Rectid: number) => (direction: boolean,  w: number, h: number, speed: number) =>
    <Body>{
      ...oid,
      pos: new Vec(xCord, yCord),
      width: w,
      height: h,
      disp: new Vec(direction ? 1 * speed : -1 * speed, 0),
      viewType: viewType,
      id: viewType + oid.id + Rectid
    };

  // create a line of car/van/wood/door objects with their own property and a given speed 
  const createLine = (viewType: ViewType) => (width: number, height: number, speed: number) => (numOnLine: number, direction: boolean) => (xCord: number, yCord: number, Rectid: number) => 
    {
      return [...Array(numOnLine)].map((_, i) => createRectangle(viewType)({id: String(i), createTime: Constants.StartTime})((xCord + i * (Constants.CanvasSize / numOnLine)), yCord, Rectid)(direction, width, height, speed));
    };
  
  const createLineOfCar = createLine('car')(scale.carWidth, 50, 1); 
  const createLineOfVan = createLine('van')(scale.vanWidth, 50, 1); 
  const createLineOfWood1 = createLine('wood')(scale.wood1Width, 50, 1);
  const createLineOfWood2 = createLine('wood')(scale.wood2Width, 50, 1);
  const createLineOfWood3 = createLine('wood')(scale.wood3Width, 50, 1);
  const createLineOfDoorO = createLine('doorO')(scale.doorWidth, 100, 0);
  // createSnakeChn = createChannel('snake')(20, 50, 2),

  const initialState: State = {
    time: 0,
    frog: createFrog(),
    score: 0,
    extraLife: 1,
    rounds: 1,
    numOfStars: 0,
    initialSpeed: 1,
    doorSec: [
      createLineOfDoorO(Constants.numOfDoor, true)(0, 0, 101)
    ],
    riverSec: [
      createLineOfWood3(2, true)(-80, 100, 201), 
      createLineOfWood2(3, false)(0, 150, 202), 
      createLineOfWood1(2, true)(100, 200, 203), 
    ],
    trafficSec: [
      createLineOfCar(3, false)(0, 300, 301),
      createLineOfVan(3, true)(10, 350, 302),
      createLineOfCar(3, false)(-50, 400, 303),
      createLineOfVan(2, true)(90, 450, 304),
      createLineOfCar(3, false)(4, 500, 305)
    ],
    doorSuccess: [],
    gameEnd: false
  };
  
  // wrap a positions around edges of the screen
  const torusWrap = ({ x, y }: Vec) => {
    const s = Constants.CanvasSize,
      wrap = (v: number) => (v < 0 ? v + s : v > s ? v - s : v);
    return new Vec(wrap(x), wrap(y));
  };
  // all movement comes through here
  const moveBody = (o: Body) => {
    if (o.viewType === 'frog') {
      let tempPos = o.pos.add(new Vec(o.disp.x, o.disp.y))
      if (tempPos.x > Constants.CanvasSize - o.width) {
        tempPos = new Vec(Constants.CanvasSize - o.width, tempPos.y);
      }
      if (tempPos.x < 0) {
        tempPos = new Vec(0, tempPos.y);
      }
      if (tempPos.y > Constants.CanvasSize - o.height) {
        tempPos = new Vec(tempPos.x, Constants.CanvasSize - o.height);
      }
      if (tempPos.y < 0) {
        tempPos = new Vec(tempPos.x, 0);
      }
      return tempPos;
    }
    else {      
      return torusWrap(o.pos.add(new Vec(o.disp.x, o.disp.y))) 
    }
  };
  // chenge body movement through moveBody
  const movePos = (o: Body) => <Body>{
    ...o,
    pos: moveBody(o),
  };
  const movefrog = (o: Body) => <Body>{
    ...o,
    pos: moveBody(o),
    disp: Vec.ZeroPos
  };
  // teleport to a given pos 
  const teleport = (o: Body, pos: Vec) =>
    <Body>{
      ...o,
      pos: pos,
      disp: Vec.ZeroPos,
    };
  
  const handleCollisions = (s: State) => {
    // for checking if two body are colliding
    function doubles(a: Body, b: Body) {
      const aYcord = a.pos.x + a.width;
      const bYcord = b.pos.x + b.width;
      if (b.pos.x < a.pos.x && a.pos.x < bYcord) {
        return true;
      } else if (b.pos.x < aYcord && aYcord < bYcord) {
        return true;
      } else {
        return false;
      }
    };
    const bodiesCollided = ([a, b]: [Body, Body]) => (a.pos.y === b.pos.y) && doubles(a, b);

    const inDoor = (body: Body) => (body.pos.y >= Constants.yRangeOfDoor[0] && body.pos.y <= Constants.yRangeOfDoor[1]);
    const inRiver = (body: Body) => (body.pos.y >= Constants.yRangeOfRiver[0] && body.pos.y <= Constants.yRangeOfRiver[1]);
    const inTraffic = (body: Body) => (body.pos.y >= Constants.yRangeOfTraffic[0] && body.pos.y <= Constants.yRangeOfTraffic[1]);
    
    const collidiedWithWood = (s.riverSec.map((river) => river.filter((r) => (bodiesCollided([s.frog, r])) && (r.viewType === 'wood')))).map((arr) => arr.length).reduce((x, y) => x + y, 0) > 0;
    const collidiedWithVeh = (s.trafficSec.map((body) => body.filter((r) => bodiesCollided([s.frog, r])))).map((arr) => arr.length).reduce((x, y) => x + y, 0) > 0;
    const collidiedWithDoorO = (s.doorSec.map((door) => door.filter((r) => (bodiesCollided([s.frog, r]) && r.viewType === 'doorO'))).map((arr) => arr.length).reduce((x, y) => x + y, 0) > 0);
    const collidiedWithDoorC = (s.doorSec.map((door) => door.filter((r) => (bodiesCollided([s.frog, r]) && r.viewType === 'doorC')))).map((arr) => arr.length).reduce((x, y) => x + y, 0) > 0;
    const checkNumOfLifes = (s.extraLife - 1 >= 0) ? false : true;
    // function: indoor = +score, teleport to initial pos 
    function withDoor(a: Body, b: Body): Body | null {
      if (doubles(a, b) && inDoor(a)) {
        return b;
      }
      else {
        return null;
      }
    }

    // refactor function !!
    const addPrefix = (b: Body) => (prefix: string) => {
      return {
        ...b,
        id: prefix + b.id
      };
    }
    const fillTarget = s.doorSec[0].map((b) => withDoor(s.frog, b)).filter((b) => b);
    const updateDoor = (fillTarget: ReadonlyArray<Body | null>, s: State) => {
      return fillTarget[0] ? s.doorSuccess.concat([addPrefix(fillTarget[0])("flag")]) : s.doorSuccess;
    };
    // const finalFillTarget = fillTarget[0]?.id
    console.log(updateDoor(fillTarget, s));


    // function fillTarget(body: Body) {
    //   if (collidiedWithDoorO) {
        
    //   }
    // }
    // function: collidied with veh or river = game over
    function collidiedAndDie(body: Body) {
      if (inDoor(body)) {
        if (collidiedWithDoorC) {
          return true;
        } else if (collidiedWithDoorO) {
          return false;
        } else {
          return false;
        }
      } else if (inRiver(body)) {
        return collidiedWithWood ? false : true;
      } else if (inTraffic(body)) {
        return collidiedWithVeh;
      } else {
        return false;
      }
    };
    // function: check gameover 
    function checkGameOver(a: boolean) {
      if (a) {
        return checkNumOfLifes;
      } else {
        return false;
      } 
    };
    // console.log(collidiedWithDoorC);
    return <State>{
      ...s,
      score: fillTarget[0] ? s.score + Constants.doorPrice : s.score,
      frog: fillTarget[0] ? teleport(s.frog, Vec.StartPos) : s.frog,
      doorSuccess: updateDoor(fillTarget, s),
      // frog: tempEnd ? teleport(s.frog, Vec.StartPos) : s.frog,
      gameEnd: checkGameOver(collidiedAndDie(s.frog)),
    };
  };

  // interval tick: manage the movement of bodies  
  const tick = (s: State, elapsed: number) => {
    return handleCollisions({
      ...s,
      frog: movefrog(s.frog),
      trafficSec: s.trafficSec.map((arr) => arr.map(movePos)),
      riverSec: s.riverSec.map((arr) => arr.map(movePos)),
      time: elapsed,
    })
  };
  
  // state transducer
  const reduceState = (s: State, e: Jump | Tick ) =>
    e instanceof Jump ? {
      ...s,
      frog: { ...s.frog, disp: new Vec(e.direction[0], e.direction[1])}
    } : tick(s, e.elapsed)

  const subscription = merge(gameClock, jumpLeft, jumpRight, jumpUp, jumpDown).pipe(
    scan(reduceState, initialState))
    .subscribe(updateView);

  function updateView(s: State) {
    const svg = document.getElementById("svgCanvas")!;
    const updateBodyView = (flag: Boolean) => (b: Body) => {     
      function createBodyView() {

        // const image = document.createElementNS(svg.namespaceURI, "div")!;
        // image.setAttribute("id", b.id);

        // image.setAttribute("x", String(b.pos.x));
        // image.setAttribute("y", String(b.pos.y));
        // image.classList.add(b.id + "Image");
        // svg.appendChild(image);

        const v = document.createElementNS(svg.namespaceURI, "rect")!;
        v.setAttribute("x", String(b.pos.x));
        v.setAttribute("y", String(b.pos.y));
        v.setAttribute("width", String(b.width));
        v.setAttribute("height", String(b.height));
        v.setAttribute("id", b.id);
        // v.setAttribute("fill-opacity", String(0.1));
        v.classList.add(flag ? 'doorC' : b.viewType)
        // const image = document.createElementNS(svg.namespaceURI, "image")!;
        // v.setAttribute("src", "../assets/frog.svg")
        svg.appendChild(v);
        // v.appendChild(image);
        return v;
      }
      const v = document.getElementById(b.id) || createBodyView();
      // const image = document.getElementById(b.id + "Image") || createBodyView();

      // image.setAttribute("x", String(b.pos.x));
      // image.setAttribute("y", String(b.pos.y));
      v.setAttribute("x", String(b.pos.x));
      v.setAttribute("y", String(b.pos.y));
      //update the score
      const score = document.getElementById("scoreCurrent") as HTMLElement;
      score.textContent = String(s.score);
    };
    //update all body obj here
    s.doorSec.forEach((arr) => arr.forEach(updateBodyView(false)));
    s.riverSec.forEach((arr) => arr.forEach(updateBodyView(false)));
    s.trafficSec.forEach((arr) => arr.forEach(updateBodyView(false)));
    s.doorSuccess.forEach(updateBodyView(true));
    updateBodyView(false)(s.frog);
    //check if game over 
    // console.log(s.gameEnd)

    if (s.gameEnd) {
      subscription.unsubscribe();
      const v = document.createElementNS(svg.namespaceURI, "text")!;
      v.setAttribute("width", String(Constants.CanvasSize / 6));
      v.setAttribute("height", String(Constants.CanvasSize / 2));
      v.setAttribute("x", String(Constants.CanvasSize / 6));
      v.setAttribute("y", String(Constants.CanvasSize / 2));
      v.classList.add("gameover");
      v.textContent = 'Game Over';      
      svg.appendChild(v);
    }
  }
}
/**
 * A simplified immutable vector class from asteroids code
 */
 class Vec {
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}
  add = (b: Vec) => new Vec(this.x + b.x, this.y + b.y);
  sub = (b: Vec) => this.add(b.scale(-1));
  len = () => Math.sqrt(this.x * this.x + this.y * this.y);
  scale = (s: number) => new Vec(this.x * s, this.y * s);
  map = (f: (n: number) => number) => new Vec(f(this.x), f(this.y))
  static StartPos = new Vec(600 / 2 - 50, 600 - 50);
  static ZeroPos = new Vec(0, 0);
}
console.log('frogger')
setTimeout(frogger, 0);

type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Space'
type Event = 'keyup' | 'keydown'

function showKeys() {
  function showKey(k:Key) {
    const arrowKey = document.getElementById(k)!,
      o = (e:Event) => fromEvent<KeyboardEvent>(document,e).pipe(
        filter(({code})=>code === k))
    o('keydown').subscribe(e => arrowKey.classList.add("highlight"))
    o('keyup').subscribe(_=>arrowKey.classList.remove("highlight"))
  }
  showKey('ArrowLeft');
  showKey('ArrowRight');
  showKey('ArrowUp');
  showKey('ArrowDown');
  showKey('Space');
}

setTimeout(showKeys, 0)

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    frogger();
  };
}
