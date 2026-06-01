export const queryRequired = <T extends Element>(selector: string, parent: ParentNode = document): T => {
  const element = parent.querySelector<T>(selector);
  if (!element) {
    throw new Error(`页面缺少必要元素: ${selector}`);
  }
  return element;
};

export const clearAndAppend = (element: Element, fragment: DocumentFragment): void => {
  element.replaceChildren(fragment);
};
