interface DivDescriptor {
  tagname: "div";
  children: ElementDescriptor[];
}

type ElementDescriptor = DivDescriptor;

export const fromDescriptor = (descriptor: ElementDescriptor): Element => {
  const element = document.createElement(descriptor.tagname);

  descriptor.children
    .map(childDescriptor => fromDescriptor(childDescriptor))
    .forEach(child => element.appendChild(child));

  return element;
};
