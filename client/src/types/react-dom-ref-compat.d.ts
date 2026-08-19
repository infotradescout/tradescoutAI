import "react";

declare module "react" {
  function useRef<T extends HTMLInputElement | null>(
    initialValue: null
  ): RefObject<Exclude<T, null>>;

  function useRef<T extends HTMLTextAreaElement | null>(
    initialValue: null
  ): RefObject<Exclude<T, null>>;
}
