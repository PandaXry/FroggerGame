/*
 * @Description: 
 * @Author: Yaoze Guo
 * @Date: 2022-08-16 21:11:50
 * @LastEditTime: 2022-09-08 02:36:49
 * @LastEditors: Yaoze Guo
 */
import { fromEvent, interval, merge } from 'rxjs'; 
import { map, filter, scan } from 'rxjs/operators';

type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'
type Event = 'keyup' | 'keydown'

function frogger() {
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
    yRangeOfRiver: [100, 250]
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
  type ViewType = 'frog' | 'wood' | 'car' | 'van' | 'doorO' | 'doorC' | 'skull' | 'star'

  // two types of game state transitions 
  class Tick {
    constructor(public readonly elapsed: number) { }
  }

  class Jump {
    constructor(public readonly direction: [number, number]) { }
  }
  
  // gameClock and user interface transitions
  const gameClock = interval(10).pipe(map((elapsed) => new Tick(elapsed))),
    keyObservable = <T>(e: Event, k: Key, result: () => T) =>
      fromEvent<KeyboardEvent>(document, e).pipe(
        filter(({ code }) => code === k),
        filter(({ repeat }) => !repeat),
        map(result)
      );
  const jumpLeft = keyObservable(
      'keydown',
      'ArrowLeft',
      () => new Jump([-1 * Constants.jumpSize, 0])
    );
  const jumpRight = keyObservable(
      'keydown',
      'ArrowRight',
      () => new Jump([1 * Constants.jumpSize, 0])
    );
  const jumpUp = keyObservable(
      'keydown',
      'ArrowUp',
      () => new Jump([0, -1 * Constants.jumpSize])
    );
  const jumpDown = keyObservable(
      'keydown',
      'ArrowDown',
      () => new Jump([0, 1 * Constants.jumpSize])
    );

  type Rectangle = Readonly<{pos: Vec; width: number; height: number; disp: Vec, dispWithObj: Vec}>;
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
      dispWithObj: new Vec(0,0),
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
      dispWithObj: new Vec(0,0),
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
  const createLineOfDoorO = createLine('doorO')(scale.doorWidth, 50, 0);
  // createSnakeChn = createChannel('snake')(20, 50, 2),

  const initialState: State = {
    time: 0,
    frog: createFrog(),
    score: 0,
    extraLife: 0,
    rounds: 1,
    numOfStars: 0,
    initialSpeed: 1,
    riverSec: [
      createLineOfWood3(3, true)(0, 100, 201), 
      createLineOfWood2(4, false)(0, 150, 202), 
      createLineOfWood1(5, true)(0, 200, 203), 
    ],
    trafficSec: [
      createLineOfCar(5, false)(0, 300, 301),
      createLineOfVan(3, true)(0, 350, 302),
      createLineOfCar(4, false)(0, 400, 303)
    ],
    doorSec: [
      createLineOfDoorO(Constants.numOfDoor, true)(0, 0, 101)
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
  const moveBody = (o: Body) =>
    <Body>{
      ...o,
      pos: torusWrap(o.pos.add(o.disp)),
      disp: o.viewType === 'frog' || o.viewType === 'doorO' ? new Vec(0, 0) : o.disp
    };
  const handleCollisions = (s: State) => {
    //create a function for checking if two body are colliding, and evaluating if frog have one more life to play
    // function bodiesCollided(a: Body, b: Body) {
    //   // if (a.pos.sub(b.pos).len() < a.width + b.width) {
    //   //   // if (a.viewType === 'frog' && b.viewType === 'star') {
    //   //   //   s.extraLife += 1;
    //   //   // if (s.extraLife - 1 >= 0) {
    //   //   //   return <State>{
    //   //   //     ...s,
    //   //   //     extraLife: s.extraLife - 1
    //   //   //   };
    //   //   // }
    //   //   // return s.extraLife - 1 <= 0 ? false : true;
    //   // }
    // };
    const bodiesCollided = (a: Body, b: Body) => a.pos.sub(b.pos).len() < a.width + b.width;
    return <State>{
      ...s,
      gameOver: bodiesCollided,
    };
  },
  // interval tick: bodies move, bullets expire
  tick = (s: State, elapsed: number) => {
    // const expired = (b: Body) => elapsed - b.createTime > 100,
    //   expiredBullets: Body[] = s.bullets.filter(expired),
    //   activeBullets = s.bullets.filter(not(expired));
    return handleCollisions({
      ...s,
      frog: moveBody(s.frog),
      trafficSec: s.trafficSec.map((arr) => arr.map(moveBody)),
      riverSec: s.riverSec.map((arr) => arr.map(moveBody)),
      time: elapsed,
    });
  },
  // state transducer
  reduceState = (s: State, e: Jump | Tick ) =>
    e instanceof Jump
      ? { ...s, frog: { ...s.frog, spd: e.direction } }
      : tick(s, e.elapsed);

// main game stream
const subscription = merge(
  gameClock,
  jumpLeft,
  jumpRight,
  jumpUp,
  jumpDown
).pipe(scan(reduceState, initialState)).subscribe(updateView);

// Update the svg scene.
// This is the only impure function in this program
function updateView(s: State) {
  const
    svg = document.getElementById("svgCanvas")!,
    show = (id: string, condition: boolean) => ((e: HTMLElement) =>
      condition ? e.classList.remove('hidden')
        : e.classList.add('hidden'))(document.getElementById(id)!),     // decide if a body should be visible
    updateBodyView = (flag: Boolean) => (b: Body) => {      // flag indicates whether the element is a flag type
      function createBodyView() {
        const v = document.createElementNS(svg.namespaceURI, "rect")!;
        v.setAttribute("x", String(b.pos.x));
        v.setAttribute("y", String(b.pos.y));
        v.setAttribute("width", String(b.width));
        v.setAttribute("height", String(b.height));
        v.setAttribute("id", b.id);
        v.classList.add(flag ? 'flag' : b.viewType)
        svg.appendChild(v)
        return v;
      }
      const v = document.getElementById(b.id) || createBodyView();
      v.setAttribute("x", String(b.pos.x));
      v.setAttribute("y", String(b.pos.y));
      //update the score
      const score = document.getElementById("scoretxt") as HTMLElement;
      score.textContent = String(s.score);


      // scoreTxt.textContent = String(s.score);

      // console.log(s.trafObj[0].pos.x, s.trafObj[0].pos.y);
    };
  s.trafficSec.forEach((arr) => arr.forEach(updateBodyView(false)));
  s.riverSec.forEach((arr) => arr.forEach(updateBodyView(false)));
  s.doorSec.forEach((arr) => arr.forEach(updateBodyView(false)));

  s.doorSuccess.forEach(updateBodyView(true));

  updateBodyView(false)(s.frog);

  if (s.gameEnd) {
    subscription.unsubscribe();
    const v = document.createElementNS(svg.namespaceURI, "text")!;
    v.textContent = "Game Over";
    svg.appendChild(v);
  }
}
}

setTimeout(frogger, 0);

function showKeys() {
  function showKey(k: Key) {
    const arrowKey = document.getElementById(k)!,
      o = (e: Event) =>
        fromEvent<KeyboardEvent>(document, e).pipe(
          filter(({ code }) => code === k)
        );
    o('keydown').subscribe((e) => arrowKey.classList.add('highlight'));
    o('keyup').subscribe((_) => arrowKey.classList.remove('highlight'));
  }
  showKey('ArrowLeft');
  showKey('ArrowRight');
  showKey('ArrowUp');
  showKey('ArrowDown');
}

setTimeout(showKeys, 0);

/////////////////////////////////////////////////////////////////////
// Utility functions

/**
 * A simplified  immutable vector class from asteroids code
 */
class Vec {
  constructor(public readonly x: number = 0, public readonly y: number = 0) {}
  add = (b: Vec) => new Vec(this.x + b.x, this.y + b.y);
  sub = (b: Vec) => this.add(b.scale(-1));
  len = () => Math.sqrt(this.x * this.x + this.y * this.y);
  scale = (s: number) => new Vec(this.x * s, this.y * s);
  map = (f: (n: number) => number) => new Vec(f(this.x), f(this.y))
  xMap = (f: (n: number) => number) => new Vec(f(this.x), this.y)
  static Zero = new Vec();
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
// if (typeof window !== "undefined") {
//   window.onload = () => {
//     frogger();
//   };
// }
