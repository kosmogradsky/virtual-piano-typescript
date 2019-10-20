import * as CSS from "csstype";

export class Style {
  readonly type = "Style";

  constructor(readonly properties: CSS.Properties) {}
}

export class Dataset {
  readonly type = "Dataset";

  constructor(readonly properties: Record<string, string>) {}
}

export class StringProperty {
  readonly type = "StringProperty";

  constructor(readonly name: string, readonly value: string) {}
}

export class ClassName extends StringProperty {
  constructor(value: string) {
    super("className", value);
  }
}

export class Type extends StringProperty {
  constructor(value: string) {
    super("type", value);
  }
}

export class Id extends StringProperty {
  constructor(value: string) {
    super("id", value);
  }
}

export class OnClick {
  readonly type = "OnClick";

  constructor(readonly listener: () => void) {}
}

export class OnChange {
  readonly type = "OnChange";

  constructor(readonly listener: (event: Event) => void) {}
}

type Attribute = StringProperty | Style | Dataset | OnClick | OnChange;

export class Div {
  readonly tagname = "div";

  constructor(
    readonly attributes: Attribute[],
    readonly children: ElementDescriptor[]
  ) {}
}

export class Input {
  readonly tagname = "input";

  constructor(
    readonly attributes: Attribute[],
    readonly children: ElementDescriptor[]
  ) {}
}

type ElementDescriptor = Div | Input;

export const fromDescriptor = (descriptor: ElementDescriptor): Element => {
  const element = document.createElement(descriptor.tagname);

  descriptor.attributes.forEach(attribute => {
    switch (attribute.type) {
      case "StringProperty": {
        (element as any)[attribute.name] = attribute.value;
        break;
      }
      case "Style": {
        Object.entries(attribute.properties).forEach(
          ([propertyName, propertyValue]) => {
            element.style[propertyName as any] = propertyValue;
          }
        );
        break;
      }
      case "Dataset": {
        Object.entries(attribute.properties).forEach(
          ([propertyName, propertyValue]) => {
            element.dataset[propertyName] = propertyValue;
          }
        );
        break;
      }
      case "OnChange": {
        element.onchange = attribute.listener;
      }
    }
  });

  descriptor.children
    .map(childDescriptor => fromDescriptor(childDescriptor))
    .forEach(child => element.appendChild(child));

  return element;
};
