import * as React from "react";
import { instrument, Player } from "soundfont-player";
import { MIDIFile } from "./MIDIFile";
import {
  createAppStore,
  Loop,
  EMPTY,
  LoopReducer,
  SilentEff,
  ofType,
  Epic,
  Dispatch,
  combineEpics,
  Batch,
  Effect
} from "sudetenwaltz/Loop";
import * as Time from "sudetenwaltz/Time";
import {
  ignoreElements,
  tap,
  switchMap,
  map,
  skipWhile,
  take,
  toArray
} from "rxjs/operators";
import { render } from "react-dom";
import { Observable, from } from "rxjs";

// UTILS

const range = (length: number, from: number) =>
  Array(length)
    .fill(undefined)
    .map((_value, index) => from + index);

function tail<T>(arr: T[]): T | undefined {
  return arr.length > 0 ? arr[arr.length - 1] : undefined;
}

// ACTIONS

interface FetchMidiRequest {
  type: "FetchMidiRequest";
  event: React.ChangeEvent<HTMLInputElement>;
}

interface FetchMidiSuccess {
  type: "FetchMidiSuccess";
  notes: MidiNote[];
}

interface QueueNotes {
  type: "QueueNotes";
  offset: number;
}

interface NoteOn {
  type: "NoteOn";
  when: number;
}

type Action = FetchMidiRequest | FetchMidiSuccess | QueueNotes | NoteOn;

// EFFECTS

class LoadMidi extends SilentEff {
  readonly type = "LoadMidi";

  constructor(readonly event: React.ChangeEvent<HTMLInputElement>) {
    super();
  }
}

class PlayNote extends SilentEff {
  readonly type = "PlayNote";

  constructor(
    readonly pitch: number,
    readonly when: number,
    readonly duration: number,
    readonly offset: number
  ) {
    super();
  }
}

// STATE

interface MidiNote {
  when: number;
  duration: number;
  pitch: number;
}

interface UploadFileState {
  type: "UploadFileState";
}

interface ReadyToPlayState {
  type: "ReadyToPlayState";
  notes: MidiNote[];
}

interface PlayingState {
  type: "PlayingState";
  notes: MidiNote[];
}

type State = UploadFileState | ReadyToPlayState | PlayingState;

const initialState: UploadFileState = {
  type: "UploadFileState"
};

const initialLoop: Loop<State, Action> = [initialState, EMPTY];

const reducer: LoopReducer<State, Action> = (prevState, action) => {
  switch (action.type) {
    case "FetchMidiRequest": {
      return [prevState, new LoadMidi(action.event)];
    }
    case "FetchMidiSuccess": {
      const state: ReadyToPlayState = {
        type: "ReadyToPlayState",
        notes: action.notes
      };

      return [state, EMPTY];
    }
    case "QueueNotes": {
      if (
        prevState.type === "ReadyToPlayState" ||
        prevState.type === "PlayingState"
      ) {
        let notesToPlay: MidiNote[] = [];

        from(prevState.notes)
          .pipe(
            skipWhile(note =>
              prevState.type === "ReadyToPlayState"
                ? note.when < action.offset
                : note.when <= action.offset + 1
            ),
            take(100),
            toArray()
          )
          .subscribe(queuedCommands => {
            notesToPlay = queuedCommands;
          });

        const lastNote = tail(notesToPlay);

        if (lastNote === undefined) {
          return [prevState, EMPTY];
        } else {
          const nextQueueingTimeout = new Time.SetTimeout<Action>(
            (lastNote.when - action.offset - 1) * 1000,
            () => ({ type: "QueueNotes", offset: lastNote.when - 1 })
          );

          const playCommands: Effect<Action>[] = notesToPlay.map(
            note =>
              new PlayNote(note.pitch, note.when, note.duration, action.offset)
          );

          const noteOnTimeouts: Effect<Action>[] = Array.from(
            new Set(notesToPlay.map(note => note.when))
          ).map(
            when =>
              new Time.SetTimeout((when - action.offset) * 1000, () => ({
                type: "NoteOn",
                when
              }))
          );

          return [
            { type: "PlayingState", notes: prevState.notes },
            new Batch(playCommands.concat(noteOnTimeouts, nextQueueingTimeout))
          ];
        }
      }

      return [prevState, EMPTY];
    }
    case "NoteOn": {
      console.log(action.when);

      return prevState.type === "PlayingState"
        ? [
            {
              ...prevState
            },
            EMPTY
          ]
        : [prevState, EMPTY];
    }
  }
};

const prepareToPlayEpic: Epic<Action> = effect$ =>
  effect$.pipe(
    ofType<LoadMidi>("LoadMidi"),
    switchMap(async () => {
      const context = new AudioContext();
      const piano = await instrument(context as any, "acoustic_grand_piano");

      return {
        piano,
        context
      };
    }),
    switchMap(({ piano, context }) =>
      effect$.pipe(
        ofType<PlayNote>("PlayNote"),
        tap(({ when, pitch, duration, offset }) => {
          piano.play(pitch as any, context.currentTime - offset + when, {
            duration
          });
        }),
        ignoreElements()
      )
    )
  );

const loadMidiEpic: Epic<Action> = effect$ =>
  effect$.pipe(
    ofType<LoadMidi>("LoadMidi"),
    switchMap(({ event }) => {
      return new Observable<ArrayBuffer>(subscriber => {
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
            subscriber.next(reader.result);
          } else {
            throw new Error("FileReader result is not an ArrayBuffer");
          }
        };
      });
    }),
    map(buffer => {
      const midiFile = new MIDIFile(buffer);
      const parsed: {
        tracks: any[];
        duration: number;
      } = midiFile.parseSong();

      const notes = parsed.tracks
        .flatMap(track => track.notes)
        .sort((a, b) => a.when - b.when);

      return { type: "FetchMidiSuccess", notes };
    })
  );

const epic = combineEpics<Action>(
  prepareToPlayEpic,
  loadMidiEpic,
  Time.epic as Epic<Action>
);

const store = createAppStore(initialLoop, reducer, epic);

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

const Main: React.FunctionComponent<{
  state: State;
  dispatch: Dispatch<Action>;
}> = React.memo(function Main({ state, dispatch }) {
  const getControls = () => {
    switch (state.type) {
      case "UploadFileState": {
        return (
          <input
            type="file"
            onChange={event => {
              event.persist();
              dispatch({ type: "FetchMidiRequest", event });
            }}
          />
        );
      }
      case "ReadyToPlayState": {
        return (
          <>
            <button
              type="button"
              id="play-button"
              style={{ marginRight: 5 }}
              onClick={() => dispatch({ type: "QueueNotes", offset: 0 })}
            >
              Play
            </button>
            <button type="button" id="pause-button" style={{ marginRight: 5 }}>
              Pause
            </button>
            <button type="button" id="stop-button" style={{ marginRight: 5 }}>
              Stop
            </button>
            {/* <input
              id="position"
              type="range"
              min="0"
              max="100"
              value="0"
              step="1"
            /> */}
          </>
        );
      }
    }
  };

  return (
    <div
      style={{
        marginTop: 10,
        marginLeft: 10,
        height: 85,
        position: "relative"
      }}
    >
      <div style={{ marginBottom: 10, display: "flex", alignItems: "center" }}>
        {getControls()}
      </div>
      <div>
        {range(88, 21).map(keyNumber =>
          [1, 3, 6, 8, 10].includes(keyNumber % 12) ? (
            <div
              key={keyNumber}
              style={{
                left:
                  Math.floor(keyNumber / 12 - 2) * 26 * 7 +
                  26 * 2 +
                  pitchPositions[keyNumber % 12] * 26,
                position: "absolute",
                boxSizing: "border-box",
                width: 0.65 * 25,
                height: "66%",
                backgroundColor: "black",
                zIndex: 1
              }}
              data-pitch={keyNumber}
            />
          ) : (
            <div
              key={keyNumber}
              style={{
                left:
                  Math.floor(keyNumber / 12 - 2) * 26 * 7 +
                  26 * 2 +
                  pitchPositions[keyNumber % 12] * 26,
                position: "absolute",
                boxSizing: "border-box",
                marginLeft: 0.5,
                width: 25,
                height: "100%",
                border: "1px solid black",
                backgroundColor: "white"
              }}
              data-pitch={keyNumber}
            />
          )
        )}
      </div>
    </div>
  );
});

store.model$.subscribe((state: State) => {
  render(
    <Main state={state} dispatch={store.dispatch} />,
    document.getElementById("root")
  );
});
