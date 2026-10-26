/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';

// Controlled-or-uncontrolled state. Copied from Mantine hooks.

/** State that is either controlled or uncontrolled. Copied from Mantine hooks. */
export interface UseUncontrolledOptions<T> {
  value?: T;
  defaultValue?: T;
  /** Used when neither value nor defaultValue is provided. */
  finalValue?: T;
  onChange?: (value: T, ...payload: any[]) => void;
}

export type UseUncontrolledReturnValue<T> = [T, (value: T, ...payload: any[]) => void, boolean];

export function useUncontrolled<T>({
  value,
  defaultValue,
  finalValue,
  onChange = () => {},
}: UseUncontrolledOptions<T>): UseUncontrolledReturnValue<T> {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue !== undefined ? defaultValue : finalValue);

  const handleUncontrolledChange = (val: T, ...payload: any[]) => {
    setUncontrolledValue(val);
    onChange?.(val, ...payload);
  };

  if (value !== undefined) {
    return [value as T, onChange, true];
  }

  return [uncontrolledValue as T, handleUncontrolledChange, false];
}
