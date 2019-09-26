export interface OkExtract<A> {
  type: "Result/Ok";
  value: A;
}

export interface ErrExtract<E> {
  type: "Result/Err";
  error: E;
}

export interface Result<E, A> {
  map<B>(mapper: (from: A) => B): Result<E, B>;
  flatMap<B>(mapper: (from: A) => Result<E, B>): Result<E, B>;
  withDefault(defaultValue: A): A;
  extract(): OkExtract<A> | ErrExtract<E>;
}

export class Ok<A> implements Result<never, A> {
  constructor(readonly value: A) {}

  withDefault() {
    return this.value;
  }

  map<B>(mapper: (from: A) => B): Result<never, B> {
    return new Ok(mapper(this.value));
  }

  flatMap<B>(mapper: (from: A) => Result<never, B>): Result<never, B> {
    return mapper(this.value);
  }

  extract(): OkExtract<A> {
    return { type: "Result/Ok", value: this.value };
  }
}

export class Err<E> implements Result<E, never> {
  constructor(readonly error: E) {}

  withDefault<A>(defaultValue: A) {
    return defaultValue;
  }

  map() {
    return this;
  }

  flatMap() {
    return this;
  }

  extract(): ErrExtract<E> {
    return { type: "Result/Err", error: this.error };
  }
}

export const fromNull = <E, A>(err: E, value: A | null): Result<E, A> =>
  value === null ? new Err(err) : new Ok(value);

export const fromUndefined = <E, A>(
  err: E,
  value: A | undefined
): Result<E, A> => (value === undefined ? new Err(err) : new Ok(value));

export const map3 = <E, A, B, C, D>(
  ra: Result<E, A>,
  rb: Result<E, B>,
  rc: Result<E, C>,
  mapper: (a: A, b: B, c: C) => D
): Result<E, D> => {
  const raExtract = ra.extract();
  if (raExtract.type === "Result/Ok") {
    const rbExtract = rb.extract();
    if (rbExtract.type === "Result/Ok") {
      const rcExtract = rc.extract();
      if (rcExtract.type === "Result/Ok") {
        return new Ok(
          mapper(raExtract.value, rbExtract.value, rcExtract.value)
        );
      } else {
        return new Err(rcExtract.error);
      }
    } else {
      return new Err(rbExtract.error);
    }
  } else {
    return new Err(raExtract.error);
  }
};
