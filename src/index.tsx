import {
  fromDescriptor,
  Div,
  Style,
  Dataset,
  Input,
  Type,
  Id,
  OnChange
} from "./declarativeHtml";
import { instrument } from "soundfont-player";
import { MIDIFile } from "./MIDIFile";
import { createAppStore, Loop, EMPTY, LoopReducer } from "sudetenwaltz/Loop";
import { EMPTY as RX_EMPTY } from "rxjs";

// import * as React from "react";
// import { render } from "react-dom";
// import { createStore, StoreEnhancer, Store, compose } from "redux";
// import { createEnchancer, LoopReducer, EMPTY, Loop } from "sudetenwaltz/Loop";
// import { EMPTY as RX_EMPTY } from "rxjs";

// // ACTIONS

// interface SaveParsedMidi {
//   type: "SaveParsedMidi";
//   payload: unknown;
// }

// interface SaveParsedMidi {
//   type: "SaveParsedMidi";
//   payload: unknown;
// }

// type Action = SaveParsedMidi;

// // STATE

// interface State {
//   notes: MidiNote[];
//   currentIndex: number;
//   trackedNotes: Map<number, MidiNote>;
// }

// // REDUCER

// const reducer: LoopReducer<State, Action> = (prevState, action) => {
//   switch (action.type) {
//     case "SaveParsedMidi": {
//       return [
//         {
//           ...prevState,
//           notes: (action.payload as { tracks: any[] }).tracks
//             .flatMap(track => track.notes)
//             .sort((a, b) => a.when - b.when)
//         },
//         EMPTY
//       ];
//     }
//     default: {
//       return [prevState, EMPTY];
//     }
//   }
// };

// interface StoreCreator {
//   <S, A extends Action, Ext, StateExt>(
//     reducer: LoopReducer<S, A>,
//     initialLoop: Loop<S, A>,
//     enhancer?: StoreEnhancer<Ext>
//   ): Store<S & StateExt, A> & Ext;
// }

// const composeEnhancers =
//   (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

// const store: Store<State, SaveParsedMidi> = (createStore as any)(
//   reducer,
//   [{ notes: [], currentIndex: 0, trackedNotes: new Map() }, EMPTY],
//   composeEnhancers(createEnchancer(effect$ => RX_EMPTY))
// );

// type MidiNote = any;

// const getNextTick = <A extends { when: number }>(
//   step: number,
//   ticks: A[][],
//   arr: A[]
// ): A[][] => {
//   if (arr.length === 0) {
//     return ticks;
//   }

//   const maxWhen = 1 * step;
//   const takeTickNotes = (tickNotes: A[]): A[] => {
//     if (arr.length === 0 || arr[0].when > maxWhen) {
//       return tickNotes;
//     }

//     tickNotes.push(arr.shift()!);

//     return takeTickNotes(tickNotes);
//   };

//   ticks.push(takeTickNotes([]));

//   return getNextTick(++step, ticks, arr);
// };

// const positionControl = document.getElementById("position") as HTMLInputElement;

// positionControl.onchange = () => {
//   currentTime = (+positionControl.value / 100) * duration * 1000;
//   midiStack = midi.slice();
//   while (midiStack.length > 0 && midiStack[0].when * 1000 < currentTime) {
//     midiStack.shift();
//   }
// };

// const play = (midi: any) => {
//   const keys = range(21, 109).map((midiNumber): [number, Element] => [
//     midiNumber,
//     document.querySelector(`.key[data-pitch='${midiNumber}']`)!
//   ]);
//   const keysMap = Object.fromEntries(keys);

//   console.log(midi);
//   const context = new AudioContext() as any;
//   instrument(context, "acoustic_grand_piano").then(piano => {
//     // store.dispatch({ type: "SaveParsedMidi", payload: midi });

//     let interval = startLoop(piano, keysMap);
//     document.getElementById("play-button").addEventListener("click", () => {
//       interval = startLoop(piano, keysMap);
//     });
//     document.getElementById("pause-button").addEventListener("click", () => {
//       clearInterval(interval);
//     });
//     document.getElementById("stop-button").addEventListener("click", () => {
//       clearInterval(interval);
//       midiStack = midi.slice();
//       currentTime = 0;
//       positionControl.value = "0";
//     });

//     // from(midi.tracks)
//     //   .pipe(
//     //     mergeMap((track: any) =>
//     //       from(getNextTick(1, [], track.notes)).pipe(
//     //         concatMap(tick => of(tick).pipe(delay(950)))
//     //       )
//     //     ),
//     //     mergeAll()
//     //   )
//     //   .subscribe((note: any) => {
//     //     console.log(note);
//     //     piano.play(note.pitch, note.when + 2, { duration: note.duration });
//     //   });

//     // midi.tracks.forEach((track: any) =>
//     //   track.notes.forEach((note: any) => {
//     //     setTimeout(() => {
//     //       console.log(note.pitch);
//     //       piano.play(note.pitch, undefined, { duration: note.duration });
//     //       keysMap[note.pitch].classList.add("pressed");
//     //       setTimeout(() => {
//     //         keysMap[note.pitch].classList.remove("pressed");
//     //       }, note.duration * 950);
//     //     }, note.when * 1000 + 1000);
//     //   })
//     // );
//   });
// };

// const input = document.getElementById("fileInput") as HTMLInputElement;

// let midi: any[];
// let midiStack: any[];
// let currentTime = 0;
// let duration: number = 0;

// (input as HTMLInputElement).addEventListener("change", function(event) {
//   const reader = new FileReader();

//   if (input.files) {
//     reader.readAsArrayBuffer(input.files[0]);

//     reader.onloadend = () => {
//       if (reader.result instanceof ArrayBuffer) {
//         const midiFile = new MIDIFile(reader.result);
//         const parsed: {
//           tracks: any[];
//           duration: number;
//         } = midiFile.parseSong();
//         duration = parsed.duration;
//         midi = parsed.tracks
//           .flatMap(track => track.notes)
//           .sort((a, b) => a.when - b.when);
//         midiStack = midi.slice();

//         play(midi);
//       } else {
//         throw new Error("FileReader result is not an ArrayBuffer");
//       }
//     };
//   }
// });

// const startLoop = (piano: any, keysMap: any) => {
//   const intervalReference = setInterval(() => {
//     const notesToPlay = [];
//     currentTime += 5;

//     while (midiStack.length > 0 && midiStack[0].when * 1000 < currentTime) {
//       notesToPlay.push(midiStack.shift());
//     }

//     notesToPlay.forEach(note => {
//       piano.play(note.pitch, undefined, { duration: note.duration });
//       positionControl.value = ((note.when / duration) * 100).toString();
//       keysMap[note.pitch].classList.add("pressed");
//       setTimeout(() => {
//         keysMap[note.pitch].classList.remove("pressed");
//       }, note.duration * 950);
//     });
//   }, 5);

//   return intervalReference;
// };

// ACTIONS

interface FetchMidiSuccess {
  type: "FetchMidiSuccess";
  notes: MidiNote[];
}

type Action = FetchMidiSuccess;

// EFFECTS

interface RenderControls {
  type: "RenderControls";
}

// STATE

interface MidiNote {
  when: number;
  duration: number;
  pitch: number;
}

interface State {
  notes: MidiNote[];
  playQueue: MidiNote[];
}

const initialLoop: Loop<State, Action> = [
  {
    notes: [],
    playQueue: []
  },
  EMPTY
];

const reducer: LoopReducer<State, Action> = (prevState, action) => {
  switch (action.type) {
    case "FetchMidiSuccess": {
      return [{ ...prevState, notes: action.notes }, EMPTY];
    }
  }
};

const epic = () => RX_EMPTY;

const store = createAppStore(initialLoop, reducer, epic);

store.model$.subscribe(console.log.bind(console));

const range = (length: number, from: number) =>
  Array(length)
    .fill(undefined)
    .map((_value, index) => from + index);

const pitchPositions: Record<number, number> = {
  0: 0,
  1: 0.625,
  2: 1,
  3: 1.75,
  4: 2,
  5: 3,
  6: 3.6,
  7: 4,
  8: 4.7,
  9: 5,
  10: 5.75,
  11: 6
};

const element = fromDescriptor(
  new Div(
    [
      new Style({
        marginTop: "10px",
        marginLeft: "10px",
        height: "85px",
        position: "relative"
      })
    ],
    [
      new Div(
        [new Style({ marginBottom: "10px" })],
        [
          new Input(
            [
              new Type("file"),
              new OnChange(event => {
                const reader = new FileReader();

                if (event.target === null) {
                  throw new Error("event.target is null");
                }

                const target = event.target as HTMLInputElement;
                if (target.files === null) {
                  throw new Error("event.target.files is null");
                }

                reader.readAsArrayBuffer(target.files[0]);

                reader.onloadend = () => {
                  if (reader.result instanceof ArrayBuffer) {
                    const midiFile = new MIDIFile(reader.result);
                    const parsed: {
                      tracks: any[];
                      duration: number;
                    } = midiFile.parseSong();

                    const notes = parsed.tracks
                      .flatMap(track => track.notes)
                      .sort((a, b) => a.when - b.when);

                    store.dispatch({ type: "FetchMidiSuccess", notes });
                  } else {
                    throw new Error("FileReader result is not an ArrayBuffer");
                  }
                };
              })
            ],
            []
          )
        ]
      ),
      new Div(
        [],
        range(88, 21).map(keyNumber =>
          [1, 3, 6, 8, 10].includes(keyNumber % 12)
            ? new Div(
                [
                  new Style({
                    left:
                      Math.floor(keyNumber / 12 - 2) * 26 * 7 +
                      26 * 2 +
                      pitchPositions[keyNumber % 12] * 26 +
                      "px",
                    position: "absolute",
                    boxSizing: "border-box",
                    width: 0.65 * 25 + "px",
                    height: "66%",
                    backgroundColor: "black",
                    zIndex: 1
                  }),
                  new Dataset({ pitch: keyNumber.toString() })
                ],
                []
              )
            : new Div(
                [
                  new Style({
                    left:
                      Math.floor(keyNumber / 12 - 2) * 26 * 7 +
                      26 * 2 +
                      pitchPositions[keyNumber % 12] * 26 +
                      "px",
                    position: "absolute",
                    boxSizing: "border-box",
                    marginLeft: "0.5px",
                    width: "25px",
                    height: "100%",
                    border: "1px solid black",
                    backgroundColor: "white"
                  }),
                  new Dataset({ pitch: keyNumber.toString() })
                ],
                []
              )
        )
      )
    ]
  )
);

document.body.appendChild(element);
