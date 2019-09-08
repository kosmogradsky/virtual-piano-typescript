import { Result, Err, Ok, map3 } from "./Result";

class Midi {
  readonly type = "Midi";

  constructor(readonly header: MidiHeader, readonly tracks: MidiTracks) {}
}

class MidiHeader {
  readonly type = "MidiHeader";

  constructor(
    readonly format: number,
    readonly trackCount: number,
    readonly timeDivision: number
  ) {}
}

type MidiTracks = null;

const pop = (
  n: number,
  byteArray: Uint8Array
): Result<string, [Uint8Array, Uint8Array]> => {
  const result = byteArray.slice(0, n);
  const rest = byteArray.slice(n);

  return result.length === n
    ? new Ok([result, rest])
    : new Err("malformed midi: unexpected end of file");
};

const parseNumber = (byteArray: Uint8Array) =>
  byteArray.reduceRight((number, byte, index) => {
    const byteLength = 8;
    const bitshiftedValue = byte << (index * byteLength);

    return number + bitshiftedValue;
  }, 0);

const parseString = (charArray: Uint8Array) =>
  Array.from(charArray)
    .map(c => String.fromCharCode(c))
    .join("");

const parseHeader = (midiBytes: Uint8Array): Result<string, MidiHeader> => {
  const parseChunkId = (): Result<string, string> => {
    const chunkId = parseString(midiBytes.slice(0, 4));

    return chunkId === "MThd"
      ? new Ok(chunkId)
      : new Err('malformed midi: could not find "MThd"');
  };

  const parseSize = (): Result<string, number> => {
    const size = parseNumber(midiBytes.slice(4, 8));

    return size === 6
      ? new Ok(size)
      : new Err(`malformed midi: unexpected header size (${size})`);
  };

  const parseFormat = (): Result<string, number> => {
    const format = parseNumber(midiBytes.slice(8, 10));

    return format >= 0 && format <= 2
      ? new Ok(format)
      : new Err(`malformed midi: unknown format (${format})`);
  };

  const chunkId = parseChunkId();
  const size = parseSize();
  const format = parseFormat();

  const trackCount = parseNumber(midiBytes.slice(10, 12));
  const timeDivision = parseNumber(midiBytes.slice(12, 14));

  return map3(
    chunkId,
    size,
    format,
    (_c, _s, f) => new MidiHeader(f, trackCount, timeDivision)
  );
};

const parseEvents = (midiBytes: Uint8Array) => {
  const events = [];
  const onEventsCache = {};
  let lastEventCode = 0;

  while (midiBytes.length) {
    const deltaBytes = parseNextVariableChunk(midiBytes);
    const deltaTime = parseByteArrayToNumber(deltaBytes, true);
    let eventCode = 0;

    midiBytes = midiBytes.slice(deltaBytes.length);

    if (!isValidEventCode(midiBytes[0])) {
      // NOTE: we assume we have a running status if the event code is invalid
      //       in that case, reuse the last event and process the rest of the
      //       information as if it were for that type of event
      eventCode = lastEventCode;
    } else {
      eventCode = midiBytes[0];
      midiBytes = midiBytes.slice(1);
    }

    let dataBytes = [];
    let midiEvent = {};

    if (isMetaEvent(eventCode)) {
      const subtype = midiBytes[0];
      midiBytes = midiBytes.slice(1);
      const sizeBytes = parseNextVariableChunk(midiBytes);
      const size = parseByteArrayToNumber(sizeBytes, true);

      dataBytes = midiBytes.slice(sizeBytes.length, sizeBytes.length + size);
      midiEvent = processMetaEvent(
        eventCode,
        subtype,
        deltaTime,
        dataBytes,
        track
      );
      midiBytes = midiBytes.slice(sizeBytes.length + size);
    } else if (isSysexEvent(eventCode)) {
      throw new Error("TODO: sysex event processing...");
    } else if (isNoteEvent(eventCode)) {
      dataBytes = midiBytes.slice(0, 2);
      midiBytes = midiBytes.slice(dataBytes.length);
      midiEvent = processNoteEvent(eventCode, deltaTime, dataBytes, track);

      if (
        midiEvent instanceof MidiNoteOnEvent &&
        midiEvent.velocity === 0 &&
        onEventsCache[midiEvent.note]
      ) {
        // NOTE: some programs (at least Logic Pro X) appear to sometimes use note-on events with a
        //       zero velocity rather than a true note-off event...
        midiEvent = new MidiNoteOffEvent({
          code: eventCode - 0x10, // convert the code to be a "note off" code (ie 0x80-0x8f)
          delta: midiEvent.delta,
          channel: midiEvent.channel,
          note: midiEvent.note,
          velocity: midiEvent.velocity,
          track: midiEvent.track
        });
      }

      if (midiEvent instanceof MidiNoteOnEvent) {
        onEventsCache[midiEvent.note] = onEventsCache[midiEvent.note] || [];
        onEventsCache[midiEvent.note].push({
          index: events.length,
          event: midiEvent
        });
      } else if (midiEvent instanceof MidiNoteOffEvent) {
        const onEvents = onEventsCache[midiEvent.note];

        if (onEvents && onEvents.length > 0) {
          const onEvent = onEvents.shift();
          const origOnEvent = onEvent.event;
          let endNoteFound = false;
          let noteLength = events
            .slice(onEvent.index + 1)
            .reduce(function(sum, event) {
              if (endNoteFound) return sum;
              if (
                event.note === origOnEvent.note &&
                event instanceof MidiNoteOffEvent
              )
                endNoteFound = true;
              return sum + event.delta;
            }, 0);

          noteLength += midiEvent.delta;

          const updatedMidiOnEvent = new MidiNoteOnEvent({
            code: origOnEvent.code,
            subtype: origOnEvent.subtype,
            channel: origOnEvent.channel,
            note: origOnEvent.note,
            velocity: origOnEvent.velocity,
            delta: origOnEvent.delta,
            track: origOnEvent.track,
            length: noteLength
          });

          events.splice(onEvent.index, 1, updatedMidiOnEvent);

          if (onEvents.length === 0) delete onEventsCache[midiEvent.note];
        } else {
          throw new Error(
            'No starting event for note "' + midiEvent.note + '"'
          );
        }
      }
    } else if (isPolyphonicAftertouchEvent(eventCode)) {
      midiEvent = processPolyphonicAtertouchEvent(
        eventCode,
        deltaTime,
        dataBytes,
        track
      );
      midiBytes = midiBytes.slice(2);
    } else if (isControlChangeEvent(eventCode)) {
      midiEvent = processControlChangeEvent(
        eventCode,
        deltaTime,
        dataBytes,
        track
      );
      midiBytes = midiBytes.slice(2);
    } else if (isProgramChangeEvent(eventCode)) {
      midiEvent = processProgramChangeEvent(
        eventCode,
        deltaTime,
        dataBytes,
        track
      );
      midiBytes = midiBytes.slice(1);
    } else if (isChannelAftertouchEvent(eventCode)) {
      midiEvent = processChannelAftertouchEvent(
        eventCode,
        deltaTime,
        dataBytes,
        track
      );
      midiBytes = midiBytes.slice(1);
    } else if (isPitchWheelEvent(eventCode)) {
      midiEvent = processPitchWheelEvent(
        eventCode,
        deltaTime,
        dataBytes,
        track
      );
      midiBytes = midiBytes.slice(2);
    } else {
      throw new TypeError('unknown event code "' + toHex(eventCode) + '"');
    }

    lastEventCode = eventCode;

    events.push(midiEvent);
  }

  return events;
};

const parseTracks = (midiBytes: Uint8Array): Result<string, MidiTrack[]> => {
  if (midiBytes.length === 0) {
    return new Ok([]);
  }

  const chunkIdOffset = 4;

  pop(chunkIdOffset, midiBytes).map(([chunkIdBytes, chunkIdRestBytes]) => {
    const parseChunkId = () => {
      const chunkId = parseString(chunkIdBytes);

      return chunkId === "MTrk"
        ? new Ok(chunkId)
        : new Err(`Invalid header chunkId "${chunkId}"`);
    };

    return parseChunkId().map(() => {
      const trackSizeOffset = 4;

      return pop(trackSizeOffset, chunkIdRestBytes).map(
        ([trackSizeBytes, trackSizeRestBytes]) => {
          const trackSize = parseNumber(trackSizeBytes);

          return pop(trackSize, trackSizeRestBytes).map(
            ([eventsBytes, eventsRestBytes]) => {}
          );
        }
      );
    });
  });

  const trackSizeOffset = chunkIdOffset + 4;
  const trackSizeBytes = midiBytes.slice(chunkIdOffset, trackSizeOffset);
  const trackSize = parseByteArrayToNumber(trackSizeBytes);
  const eventsOffset = trackSizeOffset + trackSize;
  const eventsBytes = midiBytes.slice(trackSizeOffset, eventsOffset);
  const events = parseEvents(eventsBytes);
  const nameEvents = events.filter(function(event) {
    return event instanceof MidiMetaInstrumentNameEvent;
  });
  const trackName = nameEvents.length <= 0 ? "" : nameEvents[0].instrumentName;

  return [new MidiTrack({ events: events, name: trackName })].concat(
    parseTracks(midiBytes.slice(eventsOffset))
  );
};

export const parseMIDI = (midiBytes: Uint8Array): Result<string, Midi> => {
  const headerOffset = 14;

  pop(headerOffset, midiBytes).map(([headerBytes, restMidiBytes]) => {
    const header = parseHeader(headerBytes);
    const tracks = parseTracks(restMidiBytes);

    return tracks.length === header.trackCount
      ? new Ok(new Midi(header, tracks))
      : new Err(
          `Parsed wrong number of tracks: expected (${header.trackCount}), but got (${tracks.length})`
        );
  });
};
